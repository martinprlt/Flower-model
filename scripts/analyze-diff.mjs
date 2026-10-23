/**
 * analyze-diff.mjs — Métricas de la experiencia real, sin adivinar el encuadre.
 *
 * Resta la placa de fondo (INTRO, sin rosa) de la captura de la flor hecha con
 * la MISMA cámara. El residuo es la máscara real de la flor. Dentro de ella se
 * mide luminancia, negros y cavidades.
 *
 *   node scripts/analyze-diff.mjs [prefijo]
 */

import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

const prefix = process.argv[2] ?? 'flower'
const VIEWS = [
  { name: 'tres-cuartos', az: 34, el: 24 },
  { name: 'frontal', az: 0, el: 12 },
  { name: 'superior', az: 0, el: 72 },
  { name: 'lateral', az: 90, el: 8 },
]

const pct = (v) => (v * 100).toFixed(2) + '%'

function decodePng(path) {
  const buf = readFileSync(path)
  let off = 8
  let W = 0, H = 0, bd = 0, ct = 0, il = 0
  const idat = []
  while (off < buf.length) {
    const len = buf.readUInt32BE(off)
    const type = buf.toString('ascii', off + 4, off + 8)
    const data = buf.subarray(off + 8, off + 8 + len)
    if (type === 'IHDR') {
      W = data.readUInt32BE(0); H = data.readUInt32BE(4)
      bd = data[8]; ct = data[9]; il = data[12]
    } else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    off += 12 + len
  }
  if (bd !== 8 || il !== 0) throw new Error('PNG no soportado')
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ct]
  const raw = inflateSync(Buffer.concat(idat))
  const stride = W * ch
  const out = Buffer.alloc(W * H * 3)
  const prev = Buffer.alloc(stride)
  const cur = Buffer.alloc(stride)
  let p = 0
  for (let y = 0; y < H; y++) {
    const f = raw[p++]
    raw.copy(cur, 0, p, p + stride)
    p += stride
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0
      const b = prev[i]
      const c = i >= ch ? prev[i - ch] : 0
      let v = cur[i]
      if (f === 1) v = (v + a) & 255
      else if (f === 2) v = (v + b) & 255
      else if (f === 3) v = (v + ((a + b) >> 1)) & 255
      else if (f === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c)
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
        v = (v + pr) & 255
      }
      cur[i] = v
    }
    for (let x = 0; x < W; x++) {
      const si = x * ch
      const di = (y * W + x) * 3
      if (ch >= 3) {
        out[di] = cur[si]; out[di + 1] = cur[si + 1]; out[di + 2] = cur[si + 2]
      } else {
        out[di] = out[di + 1] = out[di + 2] = cur[si]
      }
    }
    cur.copy(prev)
  }
  return { W, H, data: out }
}

const RAMP = ' .:-=+*#%@'

const bgPrefix = prefix.startsWith('flower-mobile') ? 'bg-mobile' : 'bg'
for (const v of VIEWS) {
  const bg = decodePng(`analysis/${bgPrefix}-${v.name}.png`)
  const fl = decodePng(`analysis/${prefix}-${v.name}.png`)
  const { W, H } = fl
  if (bg.W !== W || bg.H !== H) throw new Error('tamaños distintos')

  const mask = new Uint8Array(W * H)
  let n = 0
  let minX = W, maxX = 0, minY = H, maxY = 0
  let sx = 0, sy = 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3
      const d = Math.max(
        Math.abs(fl.data[o] - bg.data[o]),
        Math.abs(fl.data[o + 1] - bg.data[o + 1]),
        Math.abs(fl.data[o + 2] - bg.data[o + 2]),
      )
      // 12/255 descarta el halo de bloom y el ruido de compresión; la flor
      // siempre deja un residuo mucho mayor.
      if (d > 12) {
        mask[y * W + x] = 1
        n++
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
        sx += x; sy += y
      }
    }
  }
  const cx = sx / Math.max(1, n)
  const cy = sy / Math.max(1, n)
  const R = Math.max(maxX - minX, maxY - minY) / 2 || 1

  const lums = []
  const dark = { 2: 0, 4: 0, 6: 0, 10: 0, 15: 0, 25: 0, 40: 0 }
  let maxL = 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!mask[y * W + x]) continue
      const o = (y * W + x) * 3
      const L = 0.2126 * fl.data[o] + 0.7152 * fl.data[o + 1] + 0.0722 * fl.data[o + 2]
      lums.push(L)
      if (L > maxL) maxL = L
      for (const k of Object.keys(dark)) if (L < Number(k)) dark[k]++
    }
  }
  lums.sort((a, b) => a - b)
  const q = (p) => lums[Math.min(lums.length - 1, Math.floor(p * lums.length))]

  console.log(`\n${v.name}  ${W}×${H}  máscara ${n}px  bbox x[${minX},${maxX}] y[${minY},${maxY}]  centro (${cx.toFixed(0)},${cy.toFixed(0)}) R=${R.toFixed(0)}`)
  console.log(`  luminancia p05 ${q(0.05).toFixed(1)} p10 ${q(0.1).toFixed(1)} p25 ${q(0.25).toFixed(1)} p50 ${q(0.5).toFixed(1)} p75 ${q(0.75).toFixed(1)} p95 ${q(0.95).toFixed(1)} max ${maxL.toFixed(0)}`)
  console.log(`  negros  <2 ${pct(dark[2] / n)}  <4 ${pct(dark[4] / n)}  <6 ${pct(dark[6] / n)}  <10 ${pct(dark[10] / n)}  <15 ${pct(dark[15] / n)}  <25 ${pct(dark[25] / n)}  <40 ${pct(dark[40] / n)}`)

  // ── Abertura del capullo: huecos horizontales en la parte superior ─────────
  // Un agujero frontal se ve como una franja de fondo entre dos pétalos. Se
  // mide el mayor tramo sin máscara flanqueado por flor, en la banda superior.
  const topLimit = Math.floor(minY + (maxY - minY) * 0.42)
  let maxGap = 0
  let maxGapRow = 0
  let gapRows = 0
  let gapSum = 0
  let enclosedHoles = 0
  for (let y = minY; y <= topLimit; y++) {
    let run = 0
    let best = 0
    let bestStart = 0
    let runStart = 0
    let seenMask = false
    for (let x = minX; x <= maxX; x++) {
      if (mask[y * W + x]) {
        if (!seenMask) seenMask = true
        if (run > best) { best = run; bestStart = runStart }
        run = 0
      } else if (seenMask) {
        if (run === 0) runStart = x
        run++
      }
    }
    if (best > maxGap) { maxGap = best; maxGapRow = y }
    if (best > 0) { gapRows++; gapSum += best }
  }
  // Huecos encerrados de verdad (fondo rodeado por flor).
  {
    const exterior = new Uint8Array(W * H)
    const st = []
    const seed = (x, y) => {
      const o = y * W + x
      if (mask[o] || exterior[o]) return
      exterior[o] = 1
      st.push(o)
    }
    for (let x = 0; x < W; x++) { seed(x, 0); seed(x, H - 1) }
    for (let y = 0; y < H; y++) { seed(0, y); seed(W - 1, y) }
    while (st.length) {
      const o = st.pop()
      const x = o % W
      const y = (o / W) | 0
      if (x > 0) seed(x - 1, y)
      if (x < W - 1) seed(x + 1, y)
      if (y > 0) seed(x, y - 1)
      if (y < H - 1) seed(x, y + 1)
    }
    for (let o = 0; o < W * H; o++) if (!mask[o] && !exterior[o]) enclosedHoles++
  }
  console.log(`  abertura superior: mayor hueco ${maxGap}px (fila ${maxGapRow}); media en filas con hueco ${(gapSum / Math.max(1, gapRows)).toFixed(1)}px; filas ${gapRows}`)
  console.log(`  huecos encerrados: ${enclosedHoles}px (${pct(enclosedHoles / Math.max(1, n))} de la flor)`)

  // ASCII: luminancia dentro de la máscara, para inspeccionar la forma.
  const cols = 96, rows = 40
  console.log('  ASCII (luminancia de la flor):')
  let out = ''
  for (let ry = 0; ry < rows; ry++) {
    let line = ''
    for (let rx = 0; rx < cols; rx++) {
      const x0 = Math.floor(minX + (rx * (maxX - minX + 1)) / cols)
      const x1 = Math.floor(minX + ((rx + 1) * (maxX - minX + 1)) / cols)
      const y0 = Math.floor(minY + (ry * (maxY - minY + 1)) / rows)
      const y1 = Math.floor(minY + ((ry + 1) * (maxY - minY + 1)) / rows)
      let s = 0, c = 0
      for (let y = y0; y < y1; y += 2) {
        for (let x = x0; x < x1; x += 2) {
          if (!mask[y * W + x]) continue
          const o = (y * W + x) * 3
          s += 0.2126 * fl.data[o] + 0.7152 * fl.data[o + 1] + 0.0722 * fl.data[o + 2]
          c++
        }
      }
      if (c === 0) { line += ' '; continue }
      const L = s / c
      let k = 0
      if (L > 3) k = 1; if (L > 7) k = 2; if (L > 13) k = 3; if (L > 22) k = 4
      if (L > 34) k = 5; if (L > 50) k = 6; if (L > 72) k = 7; if (L > 100) k = 8; if (L > 135) k = 9
      line += RAMP[k]
    }
    out += '  ' + line.replace(/\s+$/, '') + '\n'
  }
  console.log(out)
}

console.log('')
