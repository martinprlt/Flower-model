/**
 * render-rose.mjs â€” Vista previa de la geometrÃ­a en PNG, sin navegador.
 *
 * Rasterizador por software (z-buffer + Lambert + rim) y codificador PNG
 * propio sobre zlib. Es la herramienta con la que se itera la FORMA: el ASCII
 * del validador es demasiado limpio para juzgar un pÃ©talo.
 *
 *   node --experimental-strip-types scripts/render-rose.mjs [salida.png]
 */

import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { buildRoseArrays, ROSE_PARAMS } from '../src/math/rose.ts'

// â”€â”€ PNG â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// â”€â”€ raster â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  const N = g.normal

  // Fondo: el mismo degradado oscuro que la app, para juzgar el color real.
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

    // Normal geomÃ©trica (no la del atributo: la del atributo es por vÃ©rtice y
    // aquÃ­ necesitamos la de la cara).
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
  void N
  return img
}

function gamma(buf) {
  const out = Buffer.alloc(buf.length)
  for (let i = 0; i < buf.length; i++) {
    const v = Math.max(0, Math.min(1, buf[i]))
    // ACES aproximado + sRGB. Lo mismo que harÃ¡ el renderer en el navegador.
    const a = (v * (2.51 * v + 0.03)) / (v * (2.43 * v + 0.59) + 0.14)
    const s = a <= 0.0031308 ? a * 12.92 : 1.055 * Math.pow(a, 1 / 2.4) - 0.055
    out[i] = Math.round(Math.max(0, Math.min(1, s)) * 255)
  }
  return out
}

// â”€â”€ main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const tier = process.argv[3] ?? 'high'
const res = process.argv[4] ? JSON.parse(process.argv[4]) : {}
const params = { ...ROSE_PARAMS[tier], ...res }
const g = buildRoseArrays(params, { skipNormalize: true })

const TW = 640
const TH = 520
const COLS = 2
const ROWS = 2
const GAP = 8
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

const out = process.argv[2] ?? 'preview.png'
writeFileSync(out, encodePng(W, H, gamma(sheet)))
console.log(`${out}  ${W}x${H}  tier=${tier}  ${JSON.stringify(res)}  d/h=${g.bounds.aspect.toFixed(2)}`)