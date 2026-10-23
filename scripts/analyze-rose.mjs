/**
 * analyze-rose.mjs — Diagnóstico geométrico objetivo de la rosa.
 *
 * No depende de la iluminación de la app: rasteriza la malla real con un
 * z-buffer y mide, por vista:
 *
 *   · huecos ENCERRADOS: píxeles de fondo que no se conectan con el borde de
 *     la imagen. Son agujeros de verdad, no concavidades de la silueta.
 *   · cavidades: píxeles cubiertos que quedan muy por detrás de su entorno
 *     (proxy de las sombras negras del capullo).
 *   · pliegues: caras adyacentes del mismo pétalo que cambian de normal más de
 *     90°, señal de una superficie que se dobla sobre sí misma.
 *   · perfil radial de la silueta: sectores angulares vacíos.
 *
 *   node --experimental-strip-types scripts/analyze-rose.mjs [tier] [json]
 */

import { buildRoseArrays, ROSE_PARAMS } from '../src/math/rose.ts'

const tier = process.argv[2] ?? 'high'
const overrides = process.argv[3] ? JSON.parse(process.argv[3]) : {}
const params = { ...ROSE_PARAMS[tier], ...overrides }
const g = buildRoseArrays(params, { skipNormalize: true })

const W = 460
const H = 460

const VIEWS = [
  { name: 'frontal', az: 0, el: 12 },
  { name: 'tres-cuartos', az: 34, el: 24 },
  { name: 'superior', az: 0, el: 84 },
  { name: 'lateral', az: 90, el: 8 },
]

const f3 = (v) => v.toFixed(3)
const pct = (v) => (v * 100).toFixed(2) + '%'

function projectedView(azDeg, elDeg) {
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
  const project = (x, y, z) => {
    const px = x - ctr[0]
    const py = y - ctr[1]
    const pz = z - ctr[2]
    return [
      W / 2 + (px * right[0] + py * right[1] + pz * right[2]) * scale,
      H / 2 - (px * up[0] + py * up[1] + pz * up[2]) * scale,
      px * fwd[0] + py * fwd[1] + pz * fwd[2],
    ]
  }
  return { project, fwd }
}

function analyzeView(view) {
  const { project } = projectedView(view.az, view.el)
  const zb = new Float64Array(W * H).fill(Infinity)
  const P = g.position

  for (let t = 0; t < g.triangleCount * 3; t += 3) {
    const i0 = g.index[t] * 3
    const i1 = g.index[t + 1] * 3
    const i2 = g.index[t + 2] * 3
    const a = project(P[i0], P[i0 + 1], P[i0 + 2])
    const b = project(P[i1], P[i1 + 1], P[i1 + 2])
    const c = project(P[i2], P[i2 + 1], P[i2 + 2])
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
        const d = a[2] + w1 * (b[2] - a[2]) + w0 * (c[2] - a[2])
        const o = y * W + x
        if (d < zb[o]) zb[o] = d
      }
    }
  }

  const covered = (o) => zb[o] !== Infinity
  let coverCount = 0
  for (let o = 0; o < W * H; o++) if (covered(o)) coverCount++

  // ── Huecos encerrados: flood fill del fondo desde el borde ─────────────────
  const exterior = new Uint8Array(W * H)
  const stack = []
  const seed = (x, y) => {
    const o = y * W + x
    if (covered(o) || exterior[o]) return
    exterior[o] = 1
    stack.push(o)
  }
  for (let x = 0; x < W; x++) { seed(x, 0); seed(x, H - 1) }
  for (let y = 0; y < H; y++) { seed(0, y); seed(W - 1, y) }
  while (stack.length) {
    const o = stack.pop()
    const x = o % W
    const y = (o / W) | 0
    if (x > 0) seed(x - 1, y)
    if (x < W - 1) seed(x + 1, y)
    if (y > 0) seed(x, y - 1)
    if (y < H - 1) seed(x, y + 1)
  }

  const holes = new Uint8Array(W * H)
  let holeCount = 0
  for (let o = 0; o < W * H; o++) {
    if (!covered(o) && !exterior[o]) { holes[o] = 1; holeCount++ }
  }

  // Componentes de hueco (para reportar el mayor y dónde está).
  const seen = new Uint8Array(W * H)
  const components = []
  for (let o0 = 0; o0 < W * H; o0++) {
    if (!holes[o0] || seen[o0]) continue
    const comp = { size: 0, sx: 0, sy: 0, minX: W, maxX: 0, minY: H, maxY: 0 }
    const st = [o0]
    seen[o0] = 1
    while (st.length) {
      const o = st.pop()
      const x = o % W
      const y = (o / W) | 0
      comp.size++
      comp.sx += x
      comp.sy += y
      if (x < comp.minX) comp.minX = x
      if (x > comp.maxX) comp.maxX = x
      if (y < comp.minY) comp.minY = y
      if (y > comp.maxY) comp.maxY = y
      const nb = [o - 1, o + 1, o - W, o + W]
      for (const q of nb) {
        if (q >= 0 && q < W * H && holes[q] && !seen[q]) {
          // Evitar cruzar de una fila a la otra por el wrap.
          if ((q === o - 1 || q === o + 1) && ((q / W) | 0) !== y) continue
          seen[q] = 1
          st.push(q)
        }
      }
    }
    comp.cx = comp.sx / comp.size
    comp.cy = comp.sy / comp.size
    components.push(comp)
  }
  components.sort((a, b) => b.size - a.size)

  // ── Cavidades: profundidad contra el entorno (proxy de sombras negras) ─────
  // Se compara cada píxel cubierto con una media de su vecindario 13×13. Las
  // superficies lisas quedan planas; una zona metida entre pétalos, no.
  const cov = new Float64Array(W * H)
  const dep = new Float64Array(W * H)
  for (let o = 0; o < W * H; o++) {
    if (covered(o)) { cov[o] = 1; dep[o] = zb[o] }
  }
  const R = 6
  let cavity = 0
  let cavityDeep = 0
  // Profundidad de la rosa en unidades del modelo; se normaliza por el bbox.
  const depthRange = g.bounds.max[2] - g.bounds.min[2] + 1e-6
  for (let y = R; y < H - R; y++) {
    for (let x = R; x < W - R; x++) {
      const o = y * W + x
      if (!covered(o)) continue
      let sum = 0
      let n = 0
      for (let dy = -R; dy <= R; dy += 2) {
        for (let dx = -R; dx <= R; dx += 2) {
          const q = o + dy * W + dx
          if (cov[q]) { sum += dep[q]; n++ }
        }
      }
      if (n < 12) continue
      const local = sum / n
      // z crece hacia la cámara (fwd), así que dep < local ⇒ más cerca.
      const behind = local - dep[o]
      if (behind > depthRange * 0.035) cavity++
      if (behind > depthRange * 0.09) cavityDeep++
    }
  }

  // ── Perfil radial: sectores vacíos dentro de la silueta ────────────────────
  let cx = 0
  let cy = 0
  let ncov = 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (covered(y * W + x)) { cx += x; cy += y; ncov++ }
    }
  }
  cx /= Math.max(1, ncov)
  cy /= Math.max(1, ncov)
  const BINS = 96
  const maxR = new Float64Array(BINS)
  const minR = new Float64Array(BINS).fill(Infinity)
  let silMax = 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!covered(y * W + x)) continue
      const dx = x + 0.5 - cx
      const dy = y + 0.5 - cy
      const r = Math.hypot(dx, dy)
      let bin = Math.floor((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI) * BINS) % BINS
      if (bin < 0) bin += BINS
      if (r > maxR[bin]) maxR[bin] = r
      if (r < minR[bin]) minR[bin] = r
      if (r > silMax) silMax = r
    }
  }
  let emptySectors = 0
  let longestEmpty = 0
  let run = 0
  for (let i = 0; i < BINS; i++) {
    if (maxR[i] === 0) {
      emptySectors++
      run++
      if (run > longestEmpty) longestEmpty = run
    } else run = 0
  }

  return {
    coverCount,
    holeCount,
    holeRatio: holeCount / Math.max(1, coverCount),
    components: components.slice(0, 5).map((c) => ({
      size: c.size,
      pctOfCover: c.size / Math.max(1, coverCount),
      cx: c.cx,
      cy: c.cy,
      w: c.maxX - c.minX + 1,
      h: c.maxY - c.minY + 1,
    })),
    cavityRatio: cavity / Math.max(1, coverCount),
    cavityDeepRatio: cavityDeep / Math.max(1, coverCount),
    emptySectors,
    longestEmptyDeg: (longestEmpty / BINS) * 360,
  }
}

// ── Pliegues de la superficie (por pétalo) ───────────────────────────────────
function foldStats() {
  const cols = g.cols
  const P = g.position
  const petalFolds = new Array(params.petals).fill(0)
  const petalEdges = new Array(params.petals).fill(0)
  const byQ = new Float64Array(Math.max(1, params.qSeg - 1))
  const byU = new Float64Array(10)
  let worst = 1

  const faceNormal = (a, b, c) => {
    const ax = P[a], ay = P[a + 1], az = P[a + 2]
    const e1 = [P[b] - ax, P[b + 1] - ay, P[b + 2] - az]
    const e2 = [P[c] - ax, P[c + 1] - ay, P[c + 2] - az]
    const n = [
      e1[1] * e2[2] - e1[2] * e2[1],
      e1[2] * e2[0] - e1[0] * e2[2],
      e1[0] * e2[1] - e1[1] * e2[0],
    ]
    const l = Math.hypot(...n) || 1
    return [n[0] / l, n[1] / l, n[2] / l]
  }

  for (let n = 0; n < params.petals; n++) {
    // qi = 0 es la base colapsada en un punto: sus triángulos son degenerados
    // por construcción y no describen una superficie. Contarlos como pliegue
    // escondería los pliegues reales del capullo.
    for (let qi = 1; qi < params.qSeg - 1; qi++) {
      const row = n * params.qSeg + qi
      for (let c = 0; c < params.arcSeg; c++) {
        const a = (row * cols + c) * 3
        const b = (row * cols + c + 1) * 3
        const d = ((row + 1) * cols + c) * 3
        const e = ((row + 1) * cols + c + 1) * 3
        const nA = faceNormal(a, e, b)
        const nB = faceNormal(a, d, e)
        const dot = nA[0] * nB[0] + nA[1] * nB[1] + nA[2] * nB[2]
        petalEdges[n]++
        if (dot < 0.2) {
          petalFolds[n]++
          byQ[qi]++
          const ub = Math.min(9, Math.floor((c / params.arcSeg) * 10))
          byU[ub]++
        }
        if (dot < worst) worst = dot
      }
    }
  }
  const folds = petalFolds.reduce((s, v) => s + v, 0)
  const edges = petalEdges.reduce((s, v) => s + v, 0)
  return { folds, edges, ratio: folds / Math.max(1, edges), worst, perPetal: petalFolds, byQ, byU }
}

console.log(`\nANÁLISIS  tier=${tier}  overrides=${JSON.stringify(overrides)}`)
console.log(`vértices ${g.vertexCount}  triángulos ${g.triangleCount}  d/h ${g.bounds.aspect.toFixed(3)}`)
console.log(`bbox x[${f3(g.bounds.min[0])}, ${f3(g.bounds.max[0])}] y[${f3(g.bounds.min[1])}, ${f3(g.bounds.max[1])}] z[${f3(g.bounds.min[2])}, ${f3(g.bounds.max[2])}]`)

const fold = foldStats()
console.log(`\nPLIEGUES  ${fold.folds}/${fold.edges} aristas de cuadrícula (>90°)  = ${pct(fold.ratio)}   dot mínimo ${fold.worst.toFixed(3)}`)
const worstPetals = fold.perPetal
  .map((v, i) => ({ i, v }))
  .sort((a, b) => b.v - a.v)
  .slice(0, 8)
console.log(`pétalos con más pliegues: ${worstPetals.map((p) => `#${p.i}:${p.v}`).join('  ')}`)
console.log(`pliegues por q: ${Array.from(fold.byQ).map((v) => v.toFixed(0)).join(' ')}`)
console.log(`pliegues por u: ${Array.from(fold.byU).map((v) => v.toFixed(0)).join(' ')}`)

console.log('\nVISTA            huecos    mayor hueco        cavidades  profundas  sector vacío')
console.log('─'.repeat(94))
for (const v of VIEWS) {
  const r = analyzeView(v)
  const big = r.components[0]
    ? `#1 ${r.components[0].size}px ${(r.components[0].pctOfCover * 100).toFixed(1)}% @(${r.components[0].cx.toFixed(0)},${r.components[0].cy.toFixed(0)})`
    : '—'
  console.log(
    `${v.name.padEnd(16)} ${pct(r.holeRatio).padStart(8)}  ${big.padEnd(34)} ${pct(r.cavityRatio).padStart(8)}  ${pct(r.cavityDeepRatio).padStart(8)}  ${String(r.emptySectors).padStart(3)} bins (${r.longestEmptyDeg.toFixed(0)}°)`,
  )
  if (r.components.length > 1) {
    console.log(
      `  otros: ${r.components.slice(1).map((c) => `${c.size}px@(${c.cx.toFixed(0)},${c.cy.toFixed(0)})`).join('  ')}`,
    )
  }
}

console.log('')
