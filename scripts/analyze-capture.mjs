/**
 * analyze-capture.mjs — Mide las capturas REALES de la app.
 *
 * A diferencia de analyze-rose.mjs (que rasteriza la geometría sin luces),
 * aquí se proyecta la malla con la MISMA cámara de CameraRig sobre la captura
 * de Puppeteer. Así se separa:
 *
 *   · píxeles de la flor que quedaron casi negros (sombras interiores);
 *   · huecos de geometría (fondo dentro de la máscara);
 *   · distribución de luminancia por zona (centro / medio / borde).
 *
 *   node --experimental-strip-types scripts/analyze-capture.mjs
 */

import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { buildRoseArrays, ROSE_PARAMS } from '../src/math/rose.ts'

const f3 = (v) => v.toFixed(3)
const pct = (v) => (v * 100).toFixed(2) + '%'

// ── PNG: decoder mínimo para las capturas de Puppeteer ───────────────────────
function decodePng(path) {
  const buf = readFileSync(path)
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('no es PNG: ' + path)
  let off = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  let interlace = 0
  const idat = []
  while (off < buf.length) {
    const len = buf.readUInt32BE(off)
    const type = buf.toString('ascii', off + 4, off + 8)
    const data = buf.subarray(off + 8, off + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
      interlace = data[12]
    } else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    off += 12 + len
  }
  if (bitDepth !== 8 || interlace !== 0) throw new Error(`PNG no soportado: depth=${bitDepth} interlace=${interlace}`)
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType]
  if (!channels) throw new Error('colorType no soportado: ' + colorType)
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const out = Buffer.alloc(width * height * 3)
  const prev = Buffer.alloc(stride)
  const cur = Buffer.alloc(stride)
  let p = 0
  for (let y = 0; y < height; y++) {
    const filter = raw[p++]
    raw.copy(cur, 0, p, p + stride)
    p += stride
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? cur[i - channels] : 0
      const b = prev[i]
      const c = i >= channels ? prev[i - channels] : 0
      let v = cur[i]
      switch (filter) {
        case 0: break
        case 1: v = (v + a) & 255; break
        case 2: v = (v + b) & 255; break
        case 3: v = (v + ((a + b) >> 1)) & 255; break
        case 4: {
          const pa = Math.abs(b - c)
          const pb = Math.abs(a - c)
          const pc = Math.abs(a + b - 2 * c)
          const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
          v = (v + pr) & 255
          break
        }
        default: throw new Error('filtro PNG ' + filter)
      }
      cur[i] = v
    }
    for (let x = 0; x < width; x++) {
      const si = x * channels
      const di = (y * width + x) * 3
      if (channels >= 3) {
        out[di] = cur[si]
        out[di + 1] = cur[si + 1]
        out[di + 2] = cur[si + 2]
      } else {
        out[di] = out[di + 1] = out[di + 2] = cur[si]
      }
    }
    cur.copy(prev)
  }
  return { width, height, data: out }
}

// ── Cámara: réplica exacta de frameRose + setAngles ──────────────────────────
function makeCamera(g, W, H, azDeg, elDeg) {
  const b = g.bounds
  const fov = 34
  const headroom = 1.24
  const aspect = W / H
  const halfFov = (fov * Math.PI) / 360
  const r = Math.max(b.radius, 1e-4)
  const fitV = r / Math.sin(halfFov)
  const halfH = Math.atan(Math.tan(halfFov) * Math.max(aspect, 1e-3))
  const fitH = r / Math.max(Math.sin(halfH), 1e-4)
  const distance = Math.max(fitV, fitH) * headroom

  const isPortrait = aspect < 1
  const yShift = -r * (isPortrait ? 0.24 : 0.1)
  const target = [b.center[0], b.center[1] + yShift, b.center[2]]

  const az = (azDeg * Math.PI) / 180
  const el = (elDeg * Math.PI) / 180
  const eye = [
    target[0] + distance * Math.cos(el) * Math.sin(az),
    target[1] + distance * Math.sin(el),
    target[2] + distance * Math.cos(el) * Math.cos(az),
  ]

  // Base de vista (lookAt con up = +Y).
  const fwd = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]]
  let fl = Math.hypot(...fwd)
  const f = fwd.map((v) => v / fl)
  const right = [f[2], 0, -f[0]]
  let rl = Math.hypot(...right)
  const rt = right.map((v) => v / rl)
  const up = [
    rt[1] * f[2] - rt[2] * f[1],
    rt[2] * f[0] - rt[0] * f[2],
    rt[0] * f[1] - rt[1] * f[0],
  ]

  const tanHalf = Math.tan(halfFov)
  const project = (x, y, z) => {
    const px = x - eye[0]
    const py = y - eye[1]
    const pz = z - eye[2]
    const cx = px * rt[0] + py * rt[1] + pz * rt[2]
    const cy = px * up[0] + py * up[1] + pz * up[2]
    const cz = px * f[0] + py * f[1] + pz * f[2]
    if (cz <= 1e-4) return null
    const ndcX = cx / (cz * tanHalf * aspect)
    const ndcY = cy / (cz * tanHalf)
    return [W / 2 + ndcX * (W / 2), H / 2 - ndcY * (H / 2), cz]
  }
  return { project, distance, target }
}

function geometryMask(g, W, H, azDeg, elDeg, scale = 1) {
  const { project } = makeCamera(g, W, H, azDeg, elDeg)
  const mask = new Uint8Array(W * H)
  const P = g.position
  for (let t = 0; t < g.triangleCount * 3; t += 3) {
    const i0 = g.index[t] * 3
    const i1 = g.index[t + 1] * 3
    const i2 = g.index[t + 2] * 3
    const a = project(P[i0], P[i0 + 1], P[i0 + 2])
    const b = project(P[i1], P[i1 + 1], P[i1 + 2])
    const c = project(P[i2], P[i2 + 1], P[i2 + 2])
    if (!a || !b || !c) continue
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])
    if (Math.abs(area) < 1e-12) continue
    const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])))
    const maxX = Math.min(W - 1, Math.ceil(Math.max(a[0], b[0], c[0])))
    const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])))
    const maxY = Math.min(H - 1, Math.ceil(Math.max(a[1], b[1], c[1])))
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5
        const py = y + 0.5
        const w0 = ((b[0] - a[0]) * (py - a[1]) - (px - a[0]) * (b[1] - a[1])) / area
        const w1 = ((px - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (py - a[1])) / area
        if (w0 < 0 || w1 < 0 || w0 + w1 > 1) continue
        mask[(y * W + x)] = 1
      }
    }
  }
  return mask
}

const VIEWS = [
  { file: 'capture-tres-cuartos.png', name: '3/4', az: 34, el: 24 },
  { file: 'capture-frontal.png', name: 'frontal', az: 0, el: 12 },
  { file: 'capture-superior.png', name: 'superior', az: 0, el: 86 },
  { file: 'capture-lateral.png', name: 'lateral', az: 90, el: 8 },
]

const g = buildRoseArrays(ROSE_PARAMS.high)
const lumOf = (r, gg, b) => 0.2126 * r + 0.7152 * gg + 0.0722 * b

console.log('\nCAPTURAS REALES — máscara proyectada con la cámara de la app')
for (const v of VIEWS) {
  const img = decodePng(v.file)
  const { width: W, height: H, data } = img
  const mask = geometryMask(g, W, H, v.az, v.el)

  let n = 0
  let minX = W, maxX = 0, minY = H, maxY = 0, sx = 0, sy = 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!mask[y * W + x]) continue
      n++
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      sx += x; sy += y
    }
  }
  const cx = sx / Math.max(1, n)
  const cy = sy / Math.max(1, n)
  const R = Math.max(maxX - minX, maxY - minY) / 2 || 1

  const lums = []
  const dark = { 6: 0, 10: 0, 15: 0, 25: 0, 40: 0 }
  const zone = [
    { name: 'centro', n: 0, dark: 0, sum: 0, lim: 0.4 },
    { name: 'medio', n: 0, dark: 0, sum: 0, lim: 0.72 },
    { name: 'borde', n: 0, dark: 0, sum: 0, lim: 9 },
  ]
  let maxL = 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = y * W + x
      if (!mask[o]) continue
      const di = o * 3
      const L = lumOf(data[di], data[di + 1], data[di + 2])
      lums.push(L)
      if (L > maxL) maxL = L
      for (const k of Object.keys(dark)) if (L < Number(k)) dark[k]++
      const rr = Math.hypot(x - cx, y - cy) / R
      const z = zone.find((q) => rr <= q.lim) ?? zone[2]
      z.n++
      z.sum += L
      if (L < 10) z.dark++
    }
  }
  lums.sort((a, b) => a - b)
  const q = (p) => lums[Math.min(lums.length - 1, Math.floor(p * lums.length))]

  console.log(`\n${v.name}  ${W}×${H}  máscara ${n}px  bbox x[${minX},${maxX}] y[${minY},${maxY}]  R=${R.toFixed(0)}`)
  console.log(`  luminancia  p05 ${q(0.05).toFixed(1)}  p10 ${q(0.1).toFixed(1)}  p25 ${q(0.25).toFixed(1)}  p50 ${q(0.5).toFixed(1)}  p75 ${q(0.75).toFixed(1)}  p95 ${q(0.95).toFixed(1)}  max ${maxL.toFixed(0)}`)
  console.log(`  casi negro  <6 ${pct(dark[6] / n)}  <10 ${pct(dark[10] / n)}  <15 ${pct(dark[15] / n)}  <25 ${pct(dark[25] / n)}  <40 ${pct(dark[40] / n)}`)
  console.log(`  por zona    centro: media ${(zone[0].sum / Math.max(1, zone[0].n)).toFixed(1)}, <10 ${pct(zone[0].dark / Math.max(1, zone[0].n))}  |  medio: media ${(zone[1].sum / Math.max(1, zone[1].n)).toFixed(1)}, <10 ${pct(zone[1].dark / Math.max(1, zone[1].n))}  |  borde: media ${(zone[2].sum / Math.max(1, zone[2].n)).toFixed(1)}, <10 ${pct(zone[2].dark / Math.max(1, zone[2].n))}`)
}

console.log('')
