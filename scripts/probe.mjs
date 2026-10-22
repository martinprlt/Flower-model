/**
 * probe.mjs — Diagnóstico en navegador headless. NO forma parte de la app.
 *
 * Con esto se depura una flor que no se ve: recoge los errores de consola
 * (que es lo primero que hay que mirar), mide la captura y saca la silueta de
 * la rosa en ASCII para poder juzgarla sin ver una imagen.
 *
 *   node scripts/probe.mjs [--port 9119] [--w 390] [--h 844] [--wait 16000]
 *                         [--shot out.png] [--url /?debug=true]
 */

import puppeteer from 'puppeteer-core'
import { inflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : d
}
const PORT = arg('port', 9119)
const W = Number(arg('w', 390))
const H = Number(arg('h', 844))
const WAIT = Number(arg('wait', 16000))
const SHOT = arg('shot', `probe-${W}x${H}.png`)
const PAGE = arg('url', '/')
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

// ── PNG: decodificador mínimo (8 bits, sin entrelazar) ──────────────────────
function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}
function decodePng(buf) {
  let pos = 8, w = 0, h = 0, depth = 8, ctype = 6
  const idat = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4)
      depth = data[8]; ctype = data[9]
      if (data[12] !== 0) throw new Error('PNG entrelazado: no soportado')
    } else if (type === 'IDAT') idat.push(data)
    pos += 12 + len
    if (type === 'IEND') break
  }
  if (depth !== 8) throw new Error(`bitDepth ${depth}`)
  const ch = ctype === 6 ? 4 : ctype === 2 ? 3 : 4
  const raw = inflateSync(Buffer.concat(idat))
  const stride = w * ch
  const out = Buffer.alloc(w * h * ch)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    const cur = out.subarray(y * stride, (y + 1) * stride)
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0
      const b = prev ? prev[x] : 0
      const c = prev && x >= ch ? prev[x - ch] : 0
      let v = line[x]
      if (f === 1) v += a
      else if (f === 2) v += b
      else if (f === 3) v += (a + b) >> 1
      else if (f === 4) v += paeth(a, b, c)
      cur[x] = v & 0xff
    }
  }
  return { w, h, ch, data: out }
}

const rgb = (img, x, y) => {
  const i = (y * img.w + x) * img.ch
  return [img.data[i], img.data[i + 1], img.data[i + 2]]
}
const lum = (img, x, y) => {
  const [r, g, b] = rgb(img, x, y)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function maskAscii(mask, w, h, cols, rows) {
  const out = []
  for (let ry = 0; ry < rows; ry++) {
    let line = ''
    for (let cx = 0; cx < cols; cx++) {
      const x0 = ((cx / cols) * w) | 0, x1 = (((cx + 1) / cols) * w) | 0
      const y0 = ((ry / rows) * h) | 0, y1 = (((ry + 1) / rows) * h) | 0
      let hit = 0, tot = 0
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { tot++; if (mask[y * w + x]) hit++ }
      const f = tot ? hit / tot : 0
      line += f > 0.55 ? '#' : f > 0.25 ? '+' : f > 0.06 ? '.' : ' '
    }
    out.push(line)
  }
  return out.join('\n')
}

// ── arranque ───────────────────────────────────────────────────────────────
const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
  ],
})

const logs = []
const errors = []
const page = await browser.newPage()
await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 })
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`))
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))
page.on('requestfailed', (r) => errors.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText ?? ''}`))

await page.goto(`http://localhost:${PORT}${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
await new Promise((r) => setTimeout(r, 1200))

const gl = await page.evaluate(() => {
  const c = document.createElement('canvas')
  const g = c.getContext('webgl2') || c.getContext('webgl')
  if (!g) return { ok: false }
  const d = g.getExtension('WEBGL_debug_renderer_info')
  return { ok: true, version: g.getParameter(g.VERSION), renderer: d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : '?' }
})

await new Promise((r) => setTimeout(r, WAIT))
const shot = await page.screenshot({ type: 'png' })
writeFileSync(SHOT, shot)

const state = await page.evaluate(() => {
  const d = window.__ROSE_DEBUG__
  return d ? JSON.parse(JSON.stringify(d)) : null
})

const img = decodePng(Buffer.from(shot))

/**
 * La banda central: la dedicatoria vive en el 17 % inferior, la pista en el
 * 5 %, los botones en la esquina superior. Entre el 12 % y el 78 % de la
 * altura SOLO puede estar la rosa. Medir aquí evita contar el texto acento
 * (#e14b63) como si fuera un pétalo.
 */
const yTop = Math.round(img.h * 0.12)
const yBot = Math.round(img.h * 0.78)
const mask = new Uint8Array(img.w * img.h)
let rose = 0, sx = 0, sy = 0, sz = 0
let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1
let bright = 0
for (let y = yTop; y < yBot; y++) {
  for (let x = 0; x < img.w; x++) {
    const [r, g, b] = rgb(img, x, y)
    // Pétalo: rojo dominante y con cuerpo. El fondo (rgb≈7,3,4) y el halo
    // (≈30,10,22) no llegan al umbral de rojo.
    if (r > 40 && r > g * 1.9 && r > b * 1.35) {
      mask[y * img.w + x] = 1
      rose++; sx += r; sy += g; sz += b
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      if (0.2126 * r + 0.7152 * g + 0.0722 * b > 90) bright++
    }
  }
}
const bandPx = img.w * (yBot - yTop)

let total = 0, mx = 0
for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) { const v = lum(img, x, y); total += v; if (v > mx) mx = v }

console.log('═══ WEBGL ═══')
console.log(JSON.stringify(gl))
console.log('\n═══ ERRORES ═══')
console.log(errors.length ? errors.join('\n') : '(ninguno)')
console.log('\n═══ CONSOLA ═══')
console.log(logs.length ? logs.join('\n') : '(vacía)')
console.log('\n═══ ESTADO ═══')
console.log(state ? JSON.stringify(state, null, 2) : '(no expuesto)')

console.log('\n═══ FLOR ═══')
console.log(`captura      ${img.w}×${img.h}   luminancia media ${(total / (img.w * img.h)).toFixed(2)}/255  máxima ${mx.toFixed(0)}`)
if (rose === 0) {
  console.log('>>> FALLO: ninguna flor en la banda central. No se está dibujando.')
} else {
  const rw = maxX - minX + 1, rh = maxY - minY + 1
  console.log(`píxeles      ${rose}  (${((rose / bandPx) * 100).toFixed(2)} % de la banda central)`)
  console.log(`color medio  rgb(${(sx / rose).toFixed(0)}, ${(sy / rose).toFixed(0)}, ${(sz / rose).toFixed(0)})`)
  console.log(`brillo       ${((bright / rose) * 100).toFixed(1)} % de los pétalos por encima de 90/255`)
  console.log(`caja         x[${minX}, ${maxX}]  y[${minY}, ${maxY}]  =  ${rw}×${rh} px`)
  console.log(`encaje       ${((rw / img.w) * 100).toFixed(1)} % del ancho, ${((rh / img.h) * 100).toFixed(1)} % del alto`)
  const cx = ((minX + maxX) / 2 / img.w) * 100
  const cy = ((minY + maxY) / 2 / img.h) * 100
  console.log(`centro       x ${cx.toFixed(1)} %   y ${cy.toFixed(1)} %   (50/50 = centrado)`)
  const touch = minX < 2 || maxX > img.w - 3 || minY < 2 || maxY > img.h - 3
  console.log(touch ? '>>> RECORTADA: la caja toca un borde.' : 'sin recorte.')
  console.log(`brillo flor  ${(bright / rose * 100).toFixed(1)} %  <-- si es bajo, la flor se ve casi negra`)
}
console.log('\n═══ SILUETA ═══')
console.log(rose === 0 ? '(nada)' : maskAscii(mask, img.w, img.h, 74, 40))

await browser.close()