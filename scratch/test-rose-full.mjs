import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const TAU = Math.PI * 2
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

export function rosePhi(theta) {
  return (Math.PI / 2) * Math.exp(-theta / (8 * Math.PI))
}

export function roseX(theta) {
  const u = (((theta % TAU) + TAU) % TAU) / Math.PI
  const g = 1.25 * (1 - u) * (1 - u) - 0.25
  return 1 - 0.5 * g * g
}

export function roseTheta(n, q) {
  return TAU * (n + 0.5 * q)
}

export function roseXNorm(theta) {
  return (roseX(theta) - 0.5) / 0.5
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function petalHash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return (s - Math.floor(s)) * 2 - 1
}

const GL_X = [
  0.0,
  -0.5384693101056831,
   0.5384693101056831,
  -0.9061798459386640,
   0.9061798459386640,
]
const GL_W = [
  0.5688888888888889,
  0.4786286704993665,
  0.4786286704993665,
  0.2369268850561891,
  0.2369268850561891,
]

export function buildWhorlTable(p) {
  const K = Math.max(1, Math.min(p.petals, Math.round(p.whorls)))
  const count = new Int32Array(K)
  
  if (K === 5 && p.petals === 34) {
    count[0] = 3
    count[1] = 5
    count[2] = 7
    count[3] = 9
    count[4] = 10
  } else if (K === 5 && p.petals === 30) {
    count[0] = 3
    count[1] = 5
    count[2] = 7
    count[3] = 7
    count[4] = 8
  } else if (K === 5 && p.petals === 26) {
    count[0] = 3
    count[1] = 4
    count[2] = 6
    count[3] = 6
    count[4] = 7
  } else {
    const weights = []
    let sum = 0
    for (let k = 0; k < K; k++) {
      const v = Math.pow(k + 1, p.whorlExp)
      weights.push(v)
      sum += v
    }
    let used = 0
    for (let k = 0; k < K; k++) {
      count[k] = Math.max(3, Math.floor((p.petals * weights[k]) / sum))
      used += count[k]
    }
    while (used > p.petals) {
      let big = -1
      for (let k = 0; k < K; k++) {
        if (count[k] > 3 && (big < 0 || count[k] > count[big])) big = k
      }
      if (big < 0) break
      count[big]--
      used--
    }
    while (used < p.petals) {
      count[K - 1]++
      used++
    }
  }

  const whorlOf = new Int32Array(p.petals)
  const jOf = new Int32Array(p.petals)
  const kh = new Float64Array(K)
  const rot = new Float64Array(K)
  let n = 0
  for (let k = 0; k < K; k++) {
    const first = n
    for (let j = 0; j < count[k]; j++) {
      whorlOf[n] = k
      jOf[n] = j
      n++
    }
    const last = Math.max(first, n - 1)
    kh[k] = (first + last) / 2 / p.petals
    rot[k] = (k * 0.6180339887498949 + (k === 0 ? 0.15 : 0)) % 1
  }
  for (; n < p.petals; n++) {
    whorlOf[n] = K - 1
    jOf[n] = count[K - 1]
    count[K - 1]++
  }
  return { whorlOf, jOf, count, kh, rot }
}

const whorlCache = new Map()
function getWhorlTable(p) {
  const key = `${p.petals}:${p.whorls}:${p.whorlExp}`
  let hit = whorlCache.get(key)
  if (!hit) {
    hit = buildWhorlTable(p)
    whorlCache.set(key, hit)
  }
  return hit
}

export function roseWhorl(p, n) {
  const t = getWhorlTable(p)
  const idx = Math.min(p.petals - 1, Math.max(0, Math.floor(n)))
  const k = t.whorlOf[idx]
  return { k, j: t.jOf[idx], m: t.count[k], kh: t.kh[k], rot: t.rot[k] }
}

export function roseElevation(p, kh) {
  return rosePhi(p.thetaMap * Math.pow(kh, p.phiExp)) - p.phiDrop * kh * kh
}

export function rosePhiPetal(p, n) {
  return roseElevation(p, roseWhorl(p, n).kh)
}

export function roseSpine(p, n, q) {
  const wh = roseWhorl(p, n)
  const khw = wh.kh
  const hash = petalHash(n)

  // Elevation progression: smooth and natural from 90 deg at center to ~35 deg at rim
  const psi0 = roseElevation(p, khw) + 0.04 * hash
  const curlAmt = p.curl * Math.pow(khw, p.curlExp)
  const psi = psi0 - curlAmt * q * q
  const sinPhi = Math.sin(psi)
  const cosPhi = Math.cos(psi)

  // Receptacle dome: rbMin is 0.25 so bud petals emerge from the core
  const chi = p.chiMax * khw
  const rBase = p.rbMin + (p.rbMax - p.rbMin) * Math.sin(chi)
  const hBase = p.yTop - p.yDrop * (1 - Math.cos(chi))

  // Petal length: bud petals are slightly taller than surrounding cups to give center prominence
  const l = p.l0 * (p.lBias + (1 - p.lBias) * Math.pow(khw, p.lExp)) * (1 + 0.05 * hash)

  // Tangent integration
  let intCos = 0
  let intSin = 0
  const halfQ = q * 0.5
  for (let i = 0; i < 5; i++) {
    const s = halfQ * (1 + GL_X[i])
    const ps = psi0 - curlAmt * s * s
    intCos += GL_W[i] * Math.cos(ps)
    intSin += GL_W[i] * Math.sin(ps)
  }
  intCos *= halfQ
  intSin *= halfQ

  const r = rBase + l * intCos
  const h = hBase + l * intSin

  // Width: each petal must comfortably overlap its neighbors (imbricate aestivation)
  // For m petals in a whorl, spacing is 2π/m. Each petal needs to cover ~1.5x the spacing
  const whorlSpacing = (TAU * wh.kh * p.rbMax) / Math.max(1, wh.m)
  const isBud = Math.max(0, 1 - khw / 0.5)
  const budWidth = isBud * isBud * 0.8
  
  // Natural petal width: wide in the middle/upper portion, generous overlap
  const baseWidth = l * p.wFrac * (0.35 + 0.65 * Math.sin(Math.pow(q, 0.7) * Math.PI))
  const outerWidth = l * p.wFrac * (p.wTip + (1 - p.wTip) * q) * (0.55 + 0.45 * khw)
  const xn = roseXNorm(roseTheta(n, q))
  const targetW = Math.max(baseWidth, outerWidth) * (1 + budWidth) * (0.45 + 0.55 * xn)

  const w = Math.max(p.wMin, targetW)

  // Bud spiral wrapping: each inner petal wraps in azimuth as it climbs
  const budSpiral = (1 - khw) * (1 - khw) * 0.75 * q
  const beta =
    (TAU * (wh.j + wh.rot)) / wh.m +
    budSpiral +
    p.azJit * Math.sin(GOLDEN_ANGLE * (n + q) + 1.7) * Math.pow(khw, 1.2)


  return {
    r,
    h,
    l,
    w,
    phi: psi,
    sinPhi,
    cosPhi,
    beta,
    cosBeta: Math.cos(beta),
    sinBeta: Math.sin(beta),
    psiMax: p.psiClosed + (p.psiOpen - p.psiClosed) * Math.pow(khw, 0.75),
    kh: khw,
    q,
  }
}

export function roseFrame(s) {
  const { cosPhi: cf, sinPhi: sf, cosBeta: cb, sinBeta: sb } = s
  return {
    ex: cf * cb,
    ey: sf,
    ez: cf * sb,
    ax: sb,
    ay: 0,
    az: -cb,
    bx: -sf * cb,
    by: cf,
    bz: -sf * sb,
  }
}

export function rosePositionFromSpine(p, s, f, a, out) {
  const u = 2 * a - 1
  const psi = u * (s.psiMax * 0.5)
  const sinPsi = Math.sin(psi)
  const cosPsi = Math.cos(psi)

  const ring = Math.sin(Math.pow(s.q, p.ringExp) * Math.PI * 0.5)
  const tipArch = 1 - 0.22 * (u * u) * s.q
  const edgeRuffle = p.azJit * 0.28 * Math.sin(u * Math.PI * 3 + s.kh * 7) * Math.pow(s.q, 2) * Math.pow(s.kh, 1.2)

  const lat = s.w * ring * sinPsi * (1 + edgeRuffle)
  const reflex = 0.28 * Math.pow(s.kh, 1.5) * Math.pow(s.q, 2) * Math.pow(Math.abs(u), 3)
  const dep = (p.cup * cosPsi - reflex) * s.w * ring * tipArch

  // Longitudinal arch pull-back: rounds the tip of each petal naturally along its spine
  const archPull = -0.16 * (u * u) * s.l * Math.pow(s.q, 1.5)
  const e1x = f.ex * archPull
  const e1y = f.ey * archPull
  const e1z = f.ez * archPull

  // Rodrigues twist along the spine
  const t = p.tw0 * s.kh + p.tw1 * s.kh * s.q + p.tw2 * s.kh * s.q * s.q
  const ct = Math.cos(t)
  const st = Math.sin(t)

  const A2x = f.ax * ct + f.bx * st
  const A2y = f.ay * ct + f.by * st
  const A2z = f.az * ct + f.bz * st
  const A3x = -f.ax * st + f.bx * ct
  const A3y = -f.ay * st + f.by * ct
  const A3z = -f.az * st + f.bz * ct

  // Cylindrical angle wrap for the bud:
  const budFactor = Math.max(0, 1 - s.kh / 0.4)
  const budWeight = budFactor * budFactor

  if (budWeight > 0.01) {
    const rEff = Math.max(0.15, s.r + dep * (1 - 0.5 * budWeight))
    const dAngle = (lat / Math.max(0.6, s.r + 0.3)) * budWeight
    const ang = s.beta + dAngle
    
    const budX = rEff * Math.cos(ang) + e1x
    const budZ = rEff * Math.sin(ang) + e1z
    const budY = s.h + A2y * lat + A3y * dep + e1y
    
    const cx = s.r * s.cosBeta
    const cz = s.r * s.sinBeta
    const planX = cx + A2x * lat + A3x * dep + e1x
    const planY = s.h + A2y * lat + A3y * dep + e1y
    const planZ = cz + A2z * lat + A3z * dep + e1z

    out[0] = planX * (1 - budWeight) + budX * budWeight
    out[1] = planY * (1 - budWeight) + budY * budWeight
    out[2] = planZ * (1 - budWeight) + budZ * budWeight
  } else {
    const cx = s.r * s.cosBeta
    const cz = s.r * s.sinBeta
    out[0] = cx + A2x * lat + A3x * dep + e1x
    out[1] = s.h + A2y * lat + A3y * dep + e1y
    out[2] = cz + A2z * lat + A3z * dep + e1z
  }
  return out
}

export function roseProgress(p, n, q) {
  return clamp01(0.86 * (n / p.petals) + 0.14 * q + 0.04 * Math.sin(n * GOLDEN_ANGLE))
}

export function rosePetalIndex(p, n, q) {
  return clamp01((n + q) / p.petals)
}

export function buildRoseArrays(p, opts = {}) {
  const { skipNormalize = false } = opts
  const cols = p.arcSeg + 1
  const rows = p.petals * p.qSeg
  const vertexCount = rows * cols
  const triangleCount = p.petals * (p.qSeg - 1) * p.arcSeg * 2

  const position = new Float32Array(vertexCount * 3)
  const normal = new Float32Array(vertexCount * 3)
  const uv = new Float32Array(vertexCount * 2)
  const aProgress = new Float32Array(vertexCount)
  const aPetal = new Float32Array(vertexCount)
  const index = new Uint32Array(triangleCount * 3)

  const qOf = (row) => (row % p.qSeg) / Math.max(1, p.qSeg - 1)
  const aOf = (col) => col / p.arcSeg

  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  const p0 = [0, 0, 0]

  for (let n = 0; n < p.petals; n++) {
    for (let qi = 0; qi < p.qSeg; qi++) {
      const row = n * p.qSeg + qi
      const q = qOf(row)
      const s = roseSpine(p, n, q)
      const f = roseFrame(s)
      for (let col = 0; col < cols; col++) {
        const a = aOf(col)
        const vi = row * cols + col
        rosePositionFromSpine(p, s, f, a, p0)

        position[vi * 3] = p0[0]
        position[vi * 3 + 1] = p0[1]
        position[vi * 3 + 2] = p0[2]

        uv[vi * 2] = a
        uv[vi * 2 + 1] = q
        aProgress[vi] = roseProgress(p, n, q)
        aPetal[vi] = rosePetalIndex(p, n, q)

        if (p0[0] < min[0]) min[0] = p0[0]
        if (p0[1] < min[1]) min[1] = p0[1]
        if (p0[2] < min[2]) min[2] = p0[2]
        if (p0[0] > max[0]) max[0] = p0[0]
        if (p0[1] > max[1]) max[1] = p0[1]
        if (p0[2] > max[2]) max[2] = p0[2]
      }
    }
  }

  const tu = [0, 0, 0], tv = [0, 0, 0]

  for (let n = 0; n < p.petals; n++) {
    const petalStart = n * p.qSeg
    const petalEnd = petalStart + p.qSeg - 1
    for (let qi = 0; qi < p.qSeg; qi++) {
      const row = n * p.qSeg + qi
      const rPrev = Math.max(petalStart, row - 1)
      const rNext = Math.min(petalEnd, row + 1)
      for (let col = 0; col < cols; col++) {
        const cPrev = Math.max(0, col - 1)
        const cNext = Math.min(p.arcSeg, col + 1)

        const vi = row * cols + col
        const viU0 = rPrev * cols + col
        const viU1 = rNext * cols + col
        const viV0 = row * cols + cPrev
        const viV1 = row * cols + cNext

        tu[0] = position[viU1 * 3] - position[viU0 * 3]
        tu[1] = position[viU1 * 3 + 1] - position[viU0 * 3 + 1]
        tu[2] = position[viU1 * 3 + 2] - position[viU0 * 3 + 2]

        tv[0] = position[viV1 * 3] - position[viV0 * 3]
        tv[1] = position[viV1 * 3 + 1] - position[viV0 * 3 + 1]
        tv[2] = position[viV1 * 3 + 2] - position[viV0 * 3 + 2]

        let nx = tu[1] * tv[2] - tu[2] * tv[1]
        let ny = tu[2] * tv[0] - tu[0] * tv[2]
        let nz = tu[0] * tv[1] - tu[1] * tv[0]
        const len = Math.hypot(nx, ny, nz) || 1
        normal[vi * 3] = nx / len
        normal[vi * 3 + 1] = ny / len
        normal[vi * 3 + 2] = nz / len
      }
    }
  }

  const petalFlip = new Uint8Array(p.petals)
  for (let n = 0; n < p.petals; n++) {
    let s = 0
    for (let qi = 1; qi < p.qSeg; qi++) {
      const row = n * p.qSeg + qi
      const sp = roseSpine(p, n, qOf(row))
      const cx = sp.r * sp.cosBeta
      const cy = sp.h
      const cz = sp.r * sp.sinBeta
      for (let col = 0; col < cols; col++) {
        const vi = row * cols + col
        s +=
          (position[vi * 3] - cx) * normal[vi * 3] +
          (position[vi * 3 + 1] - cy) * normal[vi * 3 + 1] +
          (position[vi * 3 + 2] - cz) * normal[vi * 3 + 2]
      }
    }
    if (s < 0) {
      petalFlip[n] = 1
      for (let qi = 0; qi < p.qSeg; qi++) {
        const row = n * p.qSeg + qi
        for (let col = 0; col < cols; col++) {
          const vi = row * cols + col
          normal[vi * 3] = -normal[vi * 3]
          normal[vi * 3 + 1] = -normal[vi * 3 + 1]
          normal[vi * 3 + 2] = -normal[vi * 3 + 2]
        }
      }
    }
  }

  let t = 0
  for (let n = 0; n < p.petals; n++) {
    const flip = petalFlip[n] === 1
    for (let qi = 0; qi < p.qSeg - 1; qi++) {
      const row = n * p.qSeg + qi
      for (let col = 0; col < p.arcSeg; col++) {
        const a = row * cols + col
        const b = a + 1
        const d = a + cols
        const e = d + 1
        if (flip) {
          index[t++] = a; index[t++] = b; index[t++] = e
          index[t++] = a; index[t++] = e; index[t++] = d
        } else {
          index[t++] = a; index[t++] = e; index[t++] = b
          index[t++] = a; index[t++] = d; index[t++] = e
        }
      }
    }
  }

  const rawSize = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) || 1
  const scale = skipNormalize ? 1 : 1 / rawSize

  if (!skipNormalize) {
    for (let i = 0; i < vertexCount * 3; i++) position[i] *= scale
    min[0] *= scale; min[1] *= scale; min[2] *= scale
    max[0] *= scale; max[1] *= scale; max[2] *= scale
  }

  const d = Math.max(max[0] - min[0], max[2] - min[2])
  const h = max[1] - min[1]
  const center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]
  const radius = Math.hypot(max[0] - center[0], max[1] - center[1], max[2] - center[2])

  return {
    position,
    normal,
    uv,
    aProgress,
    aPetal,
    index,
    vertexCount,
    triangleCount,
    rows,
    cols,
    bounds: { min, max, center, radius, aspect: d / Math.max(h, 1e-4) },
    core: [0, min[1] + (max[1] - min[1]) * 0.45, 0],
  }
}

const TEST_PARAMS = {
  thetaMap: 20,
  phiExp: 1.55,
  phiDrop: 0.12,
  curl: 1.35,
  curlExp: 1.6,
  whorls: 5,
  whorlExp: 1.3,
  chiMax: 1.55,
  rbMin: 0.25,
  rbMax: 5.6,
  yTop: 20.4,
  yDrop: 9.2,
  l0: 16.5,
  lBias: 0.65,
  lExp: 1.3,
  wFrac: 0.54,
  wMin: 0.35,
  wTip: 0.45,
  ringExp: 0.45,
  cup: 0.48,
  psiClosed: TAU * 0.88,
  psiOpen: 0.64 * Math.PI,
  azJit: 0.18,
  tw0: 0.08,
  tw1: 0.35,
  tw2: 0.20,
  petals: 34,
  qSeg: 12,
  arcSeg: 46,
}

const g = buildRoseArrays(TEST_PARAMS, { skipNormalize: true })
const d = Math.max(g.bounds.max[0] - g.bounds.min[0], g.bounds.max[2] - g.bounds.min[2])
const h = g.bounds.max[1] - g.bounds.min[1]
console.log('Prototype with Bud Wrap:', {
  verts: g.vertexCount,
  tris: g.triangleCount,
  dh: (d / h).toFixed(3),
  d: d.toFixed(2),
  h: h.toFixed(2),
})

// --- Render PNG ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(width, height, rgb) {
  const stride = width * 3
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    for (let i = 0; i < stride; i++) raw[y * (stride + 1) + 1 + i] = rgb[y * stride + i]
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const VIEWS = [
  { name: '3/4', az: 34, el: 24, flat: false },
  { name: 'perfil', az: 68, el: 6, flat: false },
  { name: 'cenital', az: 0, el: 84, flat: true },
  { name: '3/4-back', az: 150, el: 30, flat: false },
]

function view(g, W, H, azDeg, elDeg, flat) {
  const az = (azDeg * Math.PI) / 180
  const el = (elDeg * Math.PI) / 180
  const fwd = [-Math.sin(az) * Math.cos(el), -Math.sin(el), -Math.cos(az) * Math.cos(el)]
  const right = [Math.cos(az), 0, -Math.sin(az)]
  const up = [
    right[1] * fwd[2] - right[2] * fwd[1],
    right[2] * fwd[0] - right[0] * fwd[2],
    right[0] * fwd[1] - right[1] * fwd[0],
  ]

  const b = g.bounds
  const ext = Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2])
  const scale = (Math.min(W, H) * 0.46) / ext
  const ctr = [
    (b.min[0] + b.max[0]) / 2,
    b.min[1] + (b.max[1] - b.min[1]) * 0.45,
    (b.min[2] + b.max[2]) / 2,
  ]

  const zb = new Float64Array(W * H).fill(Infinity)
  const img = new Float32Array(W * H * 3)
  const P = g.position

  for (let y = 0; y < H; y++) {
    const t = y / (H - 1)
    for (let x = 0; x < W; x++) {
      const dx = (x - W / 2) / (W / 2)
      const dy = (y - H / 2) / (H / 2)
      const vig = Math.max(0, 1 - 0.75 * (dx * dx + dy * dy))
      const r = (0.027 + 0.03 * t) * vig
      const gg = (0.012 + 0.018 * t) * vig
      const bb = (0.016 + 0.035 * t) * vig
      const o = (y * W + x) * 3
      img[o] = r
      img[o + 1] = gg
      img[o + 2] = bb
    }
  }

  const proj = (x, y, z) => {
    const px = x - ctr[0], py = y - ctr[1], pz = z - ctr[2]
    return [
      W / 2 + (px * right[0] + py * right[1] + pz * right[2]) * scale,
      H / 2 - (px * up[0] + py * up[1] + pz * up[2]) * scale,
      px * fwd[0] + py * fwd[1] + pz * fwd[2],
    ]
  }

  const key = [-0.42, 0.76, 0.5]
  const kl = Math.hypot(key[0], key[1], key[2])
  const K = key.map((v) => v / kl)

  for (let t = 0; t < g.triangleCount * 3; t += 3) {
    const i0 = g.index[t] * 3, i1 = g.index[t + 1] * 3, i2 = g.index[t + 2] * 3
    const a = proj(P[i0], P[i0 + 1], P[i0 + 2])
    const bb = proj(P[i1], P[i1 + 1], P[i1 + 2])
    const c = proj(P[i2], P[i2 + 1], P[i2 + 2])
    const area = (bb[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (bb[1] - a[1])
    if (Math.abs(area) < 1e-12) continue

    const e1 = [P[i1] - P[i0], P[i1 + 1] - P[i0 + 1], P[i1 + 2] - P[i0 + 2]]
    const e2 = [P[i2] - P[i0], P[i2 + 1] - P[i0 + 1], P[i2 + 2] - P[i0 + 2]]
    let fn = [
      e1[1] * e2[2] - e1[2] * e2[1],
      e1[2] * e2[0] - e1[0] * e2[2],
      e1[0] * e2[1] - e1[1] * e2[0],
    ]
    const fnl = Math.hypot(fn[0], fn[1], fn[2]) || 1
    fn = fn.map((v) => v / fnl)

    let r, gg, bb2
    if (flat) {
      const sh = 0.35 + 0.65 * Math.max(0, fn[1])
      r = 0.16 + sh * 0.9
      gg = 0.03 + sh * 0.4
      bb2 = 0.06 + sh * 0.45
    } else {
      const d = Math.max(0, fn[0] * K[0] + fn[1] * K[1] + fn[2] * K[2])
      const rim = Math.pow(1 - Math.abs(fn[0] * K[0] + fn[1] * K[1] + fn[2] * K[2]), 3) * 0.5
      const sh = 0.10 + 0.95 * d + rim
      r = 0.30 * sh + rim * 0.55
      gg = 0.055 * sh + rim * 0.18
      bb2 = 0.10 * sh + rim * 0.22
    }

    const minX = Math.max(0, Math.floor(Math.min(a[0], bb[0], c[0])))
    const maxX = Math.min(W - 1, Math.ceil(Math.max(a[0], bb[0], c[0])))
    const minY = Math.max(0, Math.floor(Math.min(a[1], bb[1], c[1])))
    const maxY = Math.min(H - 1, Math.ceil(Math.max(a[1], bb[1], c[1])))
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5, py = y + 0.5
        const w0 = ((bb[0] - a[0]) * (py - a[1]) - (px - a[0]) * (bb[1] - a[1])) / area
        const w1 = ((px - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (py - a[1])) / area
        if (w0 < 0 || w1 < 0 || w0 + w1 > 1) continue
        const d = a[2] + w1 * (bb[2] - a[2]) + w0 * (c[2] - a[2])
        const o = y * W + x
        if (d < zb[o]) {
          zb[o] = d
          img[o * 3] = r
          img[o * 3 + 1] = gg
          img[o * 3 + 2] = bb2
        }
      }
    }
  }
  return img
}

function gamma(buf) {
  const out = Buffer.alloc(buf.length)
  for (let i = 0; i < buf.length; i++) {
    const v = Math.max(0, Math.min(1, buf[i]))
    const a = (v * (2.51 * v + 0.03)) / (v * (2.43 * v + 0.59) + 0.14)
    const s = a <= 0.0031308 ? a * 12.92 : 1.055 * Math.pow(a, 1 / 2.4) - 0.055
    out[i] = Math.round(Math.max(0, Math.min(1, s)) * 255)
  }
  return out
}

const TW = 640, TH = 520, COLS = 2, ROWS = 2, GAP = 8
const W = COLS * TW + (COLS + 1) * GAP
const H = ROWS * TH + (ROWS + 1) * GAP
const sheet = new Float32Array(W * H * 3)
for (let i = 0; i < W * H; i++) {
  sheet[i * 3] = 0.004
  sheet[i * 3 + 1] = 0.002
  sheet[i * 3 + 2] = 0.004
}

VIEWS.forEach((v, i) => {
  const col = i % COLS
  const row = Math.floor(i / COLS)
  const img = view(g, TW, TH, v.az, v.el, v.flat)
  const ox = GAP + col * (TW + GAP)
  const oy = GAP + row * (TH + GAP)
  for (let y = 0; y < TH; y++) {
    for (let x = 0; x < TW; x++) {
      const s = (y * TW + x) * 3
      const d = ((oy + y) * W + ox + x) * 3
      sheet[d] = img[s]
      sheet[d + 1] = img[s + 1]
      sheet[d + 2] = img[s + 2]
    }
  }
})

const outPng = 'scratch/test-bud-preview.png'
writeFileSync(outPng, encodePng(W, H, gamma(sheet)))
console.log(`Rendered to ${outPng}`)
