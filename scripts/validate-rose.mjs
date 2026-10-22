/**
 * validate-rose.mjs — Gate 0.
 *
 * Verifica la matemática de la rosa sin navegador. Importa el MISMO módulo que
 * usa la app (src/math/rose.ts vía type-stripping nativo de Node), así que no
 * puede haber deriva entre lo que se valida y lo que se dibuja.
 *
 *   node --experimental-strip-types scripts/validate-rose.mjs
 *
 * Además de las aserciones numéricas, imprime dos renders ASCII con z-buffer
 * (3/4 y cenital). Es el chequeo que permite iterar la forma sin abrir nada.
 */

import { buildRoseArrays, rosePhi, rosePhiPetal, roseX, roseXNorm, ROSE_PARAMS, roseFrame, roseSpine } from '../src/math/rose.ts'

let failures = 0
let checks = 0

function check(label, ok, detail = '') {
  checks++
  if (!ok) failures++
  const tag = ok ? '  ok  ' : ' FAIL '
  console.log(`[${tag}] ${label}${detail ? '   ' + detail : ''}`)
}

function section(title) {
  console.log('\n\x1b[1m' + title + '\x1b[0m')
  console.log('─'.repeat(78))
}

const deg = (r) => (r * 180) / Math.PI
const f3 = (v) => v.toFixed(3)

const SHAPE_ONLY = process.argv.includes('--shape')

// Para juzgar la FORMA el ASCII necesita una malla cuya densidad de triángulos
// case con la resolución del lienzo: 22 848 triángulos sobre 1 800 píxeles dan
// astillas de 0.08 px² que casi nunca contienen el centro de un píxel. Aquí
// se usa la misma forma con menos columnas por pétalo, que para una silueta
// es indistinguible y para el rasterizador es legible.
const PREVIEW = { ...ROSE_PARAMS.high, arcSeg: 20 }
const preview = buildRoseArrays(PREVIEW, { skipNormalize: true })

if (SHAPE_ONLY) {
  for (const [tag, res] of [
    ['coarse', { qSeg: 3, arcSeg: 14 }],
    ['fine', { qSeg: 4, arcSeg: 44 }],
  ]) {
    const pv = buildRoseArrays({ ...ROSE_PARAMS.high, ...res }, { skipNormalize: true })
    section(`FORMA [${tag}]  d/h=${pv.bounds.aspect.toFixed(2)}  y[${pv.bounds.min[1].toFixed(1)}, ${pv.bounds.max[1].toFixed(1)}]  r=${Math.hypot(pv.bounds.max[0], pv.bounds.max[2]).toFixed(1)}`)
    console.log('── wireframe 3/4 ──')
    console.log(renderAscii(pv, 168, 78, 34, 24, { mode: 'wire' }))
    console.log('── wireframe cenital ──')
    console.log(renderAscii(pv, 96, 62, 0, 84, { mode: 'wire', flat: true }))
    console.log('── wireframe perfil ──')
    console.log(renderAscii(pv, 168, 50, 74, 4, { mode: 'wire' }))
  }
  process.exit(0)
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. X(θ): rango, crestas, valle, cúspide.
// ─────────────────────────────────────────────────────────────────────────────
section('1 · X(θ) — perfil de un pétalo')

{
  let lo = Infinity
  let hi = -Infinity
  let argLo = 0
  let argHi = 0
  const N = 400000
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2
    const v = roseX(th)
    if (v < lo) { lo = v; argLo = th }
    if (v > hi) { hi = v; argHi = th }
  }
  // crestas: máximos locales
  const peaks = []
  const STEPS = 20000
  let pv = roseX(0)
  let pm = roseX((1 / STEPS) * Math.PI * 2)
  for (let i = 2; i <= STEPS; i++) {
    const th = (i / STEPS) * Math.PI * 2
    const v = roseX(th)
    if (pm > pv && pm >= v) peaks.push(((i - 1) / STEPS) * 2)
    pv = pm
    pm = v
  }
  const valley = roseX(Math.PI)
  const cuspRight = ((roseX(1e-4) - roseX(0)) / 1e-4) * Math.PI
  const cuspLeft = ((roseX(Math.PI * 2) - roseX(Math.PI * 2 - 1e-4)) / 1e-4) * Math.PI

  console.log(`   rango            [${f3(lo)}, ${f3(hi)}]   (esperado [0.500, 1.000])`)
  console.log(`   crestas en θ/π   ${peaks.map((p) => f3(p)).join(', ')}   (esperado 0.553, 1.447)`)
  console.log(`   valle θ=π        ${f3(valley)}   (esperado 0.969 = 31/32)`)
  console.log(`   ∂X/∂u en 0+      ${f3(cuspRight)}   (esperado +2.5, cúspide)`)
  console.log(`   ∂X/∂u en 2π−     ${f3(cuspLeft)}   (esperado -2.5, cúspide)`)

  check('X en [0.5, 1]', Math.abs(lo - 0.5) < 1e-9 && Math.abs(hi - 1) < 1e-9, `[${f3(lo)}, ${f3(hi)}]`)
  check('X tiene exactamente 2 crestas', peaks.length === 2, `${peaks.length}`)
  check('crestas en 1 ± 1/√5', peaks.every((p) => Math.abs(p - (1 - 1 / Math.sqrt(5))) < 1e-3 || Math.abs(p - (1 + 1 / Math.sqrt(5))) < 1e-3), peaks.join(', '))
  check('valle en θ=π es 31/32', Math.abs(valley - 31 / 32) < 1e-9, f3(valley))
  check('cúspide en la costura', Math.abs(cuspRight - 2.5) < 1e-2 && Math.abs(cuspLeft + 2.5) < 1e-2)
  check('X es continuo en el wrap', Math.abs(roseX(0) - roseX(Math.PI * 2)) < 1e-12)
  check('X normalizado en [0,1]', (() => {
    for (let i = 0; i < 5000; i++) {
      const v = roseXNorm((i / 5000) * Math.PI * 2)
      if (v < -1e-9 || v > 1 + 1e-9) return false
    }
    return true
  })())
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. φ(θ): la tabla de elevación.
// ─────────────────────────────────────────────────────────────────────────────
section('2 · φ(θ) — elevación de los pétalos')

{
  const p = ROSE_PARAMS.high
  console.log('   pétalo      kh      θ        φ(°)')
  let prevPhi = Infinity
  let prevL = -Infinity
  let monotone = true
  const rows = []
  for (const n of [0, 5, 10, 15, 20, 25, 30, 34]) {
    const kh = n / p.petals
    const th = p.thetaMap * Math.pow(kh, p.phiExp)
    const phi = rosePhi(th)
    const L = p.l0 * (p.lBias + (1 - p.lBias) * Math.pow(kh, p.lExp))
    rows.push(`   ${String(n).padStart(5)}  ${f3(kh).padStart(7)}  ${f3(th).padStart(7)}  ${deg(phi).toFixed(1).padStart(7)}  L=${f3(L)}`)
    if (phi > prevPhi + 1e-12) monotone = false
    if (L <= prevL) monotone = false
    prevPhi = phi
    prevL = L
  }
  console.log(rows.join('\n'))
  const rim = deg(rosePhi(p.thetaMap))
  check('φ estrictamente decreciente y L creciente (interior⊂exterior)', monotone)
  check('centro ≈ 90° (capullo cerrado)', Math.abs(deg(rosePhi(0)) - 90) < 1e-9)
  check('borde muy abierto (8°–25°)', rim > 8 && rim < 25, `${rim.toFixed(1)}°`)
  check('más de la mitad de los pétalos por encima de 45°', (() => {
    let up = 0
    for (let n = 0; n < p.petals; n++) if (deg(rosePhiPetal(p, n)) > 45) up++
    return up > p.petals / 2
  })())
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Marco ortonormal.
// ─────────────────────────────────────────────────────────────────────────────
section('3 · Marco de la sección')

{
  const p = ROSE_PARAMS.high
  let maxLen = 0
  let maxDot = 0
  for (let i = 0; i <= 400; i++) {
    const n = (i / 400) * p.petals
    for (let j = 0; j <= 8; j++) {
      const s = roseSpine(p, n, j / 8)
      const f = roseFrame(s)
      const l1 = Math.hypot(f.ex, f.ey, f.ez)
      const l2 = Math.hypot(f.ax, f.ay, f.az)
      const l3 = Math.hypot(f.bx, f.by, f.bz)
      const d13 = f.ex * f.bx + f.ey * f.by + f.ez * f.bz
      const d12 = f.ex * f.ax + f.ey * f.ay + f.ez * f.az
      const d23 = f.ax * f.bx + f.ay * f.by + f.az * f.bz
      maxLen = Math.max(maxLen, Math.abs(l1 - 1), Math.abs(l2 - 1), Math.abs(l3 - 1))
      maxDot = Math.max(maxDot, Math.abs(d13), Math.abs(d12), Math.abs(d23))
    }
  }
  check('|e| = 1', maxLen < 1e-12, `max err ${maxLen.toExponential(2)}`)
  check('e·f = 0', maxDot < 1e-12, `max err ${maxDot.toExponential(2)}`)
  check('e2 siempre horizontal', (() => {
    for (let i = 0; i <= 200; i++) {
      const s = roseSpine(p, (i / 200) * p.petals, 0.5)
      if (Math.abs(roseFrame(s).ay) > 1e-15) return false
    }
    return true
  })())
}

// ─────────────────────────────────────────────────────────────────────────────
// 4-8. Geometría: NaN, degenerados, bounds, densidad, winding.
// ─────────────────────────────────────────────────────────────────────────────
const tiers = ['low', 'mid', 'high']
const built = {}

for (const tier of tiers) {
  section(`4 · Geometría [${tier}]`)
  const p = ROSE_PARAMS[tier]
  const t0 = performance.now()
  const g = buildRoseArrays(p, { skipNormalize: true })
  const dt = performance.now() - t0
  built[tier] = { g, dt }

  // NaN / Inf
  let bad = 0
  for (let i = 0; i < g.vertexCount * 3; i++) {
    if (!Number.isFinite(g.position[i])) bad++
    if (!Number.isFinite(g.normal[i])) bad++
  }
  check('sin NaN/Infinity', bad === 0, bad ? `${bad} valores` : '')

  // Normales unitarias
  let maxNormErr = 0
  for (let i = 0; i < g.vertexCount; i++) {
    const l = Math.hypot(g.normal[i * 3], g.normal[i * 3 + 1], g.normal[i * 3 + 2])
    maxNormErr = Math.max(maxNormErr, Math.abs(l - 1))
  }
  check('normales unitarias', maxNormErr < 1e-5, `max err ${maxNormErr.toExponential(2)}`)

  // Triángulos degenerados. Los de la primera hilera de cada pétalo son
  // degenerados POR CONSTRUCCIÓN (la base del pétalo es un punto: los tres
  // vértices de la cara coinciden). Se cuentan aparte para poder exigir que
  // el resto de la malla sea limpia de verdad.
  const cols = g.cols
  const isBaseQuad = (f) => {
    const row = Math.floor(g.index[f] / cols)
    return row % p.qSeg === 0
  }
  let degen = 0
  let degenBase = 0
  let minArea = Infinity
  for (let f = 0; f < g.triangleCount; f += 3) {
    const i0 = g.index[f] * 3, i1 = g.index[f + 1] * 3, i2 = g.index[f + 2] * 3
    const e1 = [g.position[i1] - g.position[i0], g.position[i1 + 1] - g.position[i0 + 1], g.position[i1 + 2] - g.position[i0 + 2]]
    const e2 = [g.position[i2] - g.position[i0], g.position[i2 + 1] - g.position[i0 + 1], g.position[i2 + 2] - g.position[i0 + 2]]
    const cx = e1[1] * e2[2] - e1[2] * e2[1]
    const cy = e1[2] * e2[0] - e1[0] * e2[2]
    const cz = e1[0] * e2[1] - e1[1] * e2[0]
    const a = Math.hypot(cx, cy, cz)
    if (a < 1e-9) {
      if (isBaseQuad(f)) degenBase++
      else degen++
    }
    if (!isBaseQuad(f)) minArea = Math.min(minArea, a)
  }
  check('resto de la malla sin triángulos degenerados', degen === 0, `${degen} de ${g.triangleCount}`)
  console.log(`   (${degenBase} degenerados en las bases, que son puntos por construcción)`)

  // Proporción ancho/alto
  const d = Math.max(g.bounds.max[0] - g.bounds.min[0], g.bounds.max[2] - g.bounds.min[2])
  const h = g.bounds.max[1] - g.bounds.min[1]
  console.log(`   bbox  x[${f3(g.bounds.min[0])}, ${f3(g.bounds.max[0])}]  y[${f3(g.bounds.min[1])}, ${f3(g.bounds.max[1])}]  z[${f3(g.bounds.min[2])}, ${f3(g.bounds.max[2])}]`)
  console.log(`   d/h = ${(d / h).toFixed(3)}   verts ${g.vertexCount}   tris ${g.triangleCount}   ${dt.toFixed(1)} ms`)
  check('d/h ∈ [1.25, 2.60] (proporción de rosa abierta)', d / h > 1.25 && d / h < 2.6, (d / h).toFixed(3))

// Cada pétalo nace de un punto: los vértices de su primera fila deben
  // colapsar todos sobre el mismo sitio (base cerrada, sin agujero).
  let baseSpread = 0
  let baseY = 0
  for (let c = 0; c < cols; c++) {
    const i = c * 3
    baseSpread = Math.max(baseSpread, Math.hypot(
      g.position[i] - g.position[0],
      g.position[i + 1] - g.position[1],
      g.position[i + 2] - g.position[2],
    ))
    baseY = g.position[1]
  }
  check('base de cada pétalo cerrada en un punto', baseSpread < 1e-6, `spread ${baseSpread.toExponential(2)}`)

  // q debe recorrer [0,1] de verdad: la punta tiene que existir.
  const lastRow = p.petals * p.qSeg - 1
  const tipSpread = (() => {
    let r = 0
    for (let c = 0; c < cols; c++) {
      const i = (lastRow * cols + c) * 3
      r = Math.max(r, Math.hypot(g.position[i], g.position[i + 2]))
    }
    return r
  })()
  const baseR = Math.hypot(g.position[0], g.position[2])
  check('la punta del pétalo llega al borde', tipSpread > baseR * 2, `r base ${baseR.toFixed(2)} → punta ${tipSpread.toFixed(2)}`)
  check('y desciende del eje hacia el borde', g.position[(lastRow * cols) * 3 + 1] < baseY, `${baseY.toFixed(2)} → ${g.position[(lastRow * cols) * 3 + 1].toFixed(2)}`)

  // Relleno por vóxeles: demasiado bajo ⇒ huecos; demasiado alto ⇒ bola.
  const RES = 96
  const grid = new Uint8Array(RES * RES * RES)
  const pad = 0.02
  for (let i = 0; i < g.vertexCount; i++) {
    const x = g.position[i * 3], y = g.position[i * 3 + 1], z = g.position[i * 3 + 2]
    const ix = Math.min(RES - 1, Math.max(0, Math.floor(((x - g.bounds.min[0]) / (d + pad)) * RES)))
    const iy = Math.min(RES - 1, Math.max(0, Math.floor(((y - g.bounds.min[1]) / (h + pad)) * RES)))
    const iz = Math.min(RES - 1, Math.max(0, Math.floor(((z - g.bounds.min[2]) / (d + pad)) * RES)))
    grid[(iy * RES + iz) * RES + ix] = 1
  }
  let occ = 0
  for (let i = 0; i < grid.length; i++) occ += grid[i]
  const fill = occ / grid.length
  console.log(`   relleno de vóxeles ${(fill * 100).toFixed(2)}%  (la rosa es una CORAZA, no un sólido: se espera poco)`)
  check('relleno sano (ni hueco, ni bola maciza)', fill > 0.0002 && fill < 0.15, `${(fill * 100).toFixed(2)}%`)

  // El winding debe mirar hacia afuera (normales de cara vs. centro).
  let outward = 0
  for (let f = 0; f < g.triangleCount; f += 3) {
    const i0 = g.index[f] * 3, i1 = g.index[f + 1] * 3, i2 = g.index[f + 2] * 3
    const e1 = [g.position[i1] - g.position[i0], g.position[i1 + 1] - g.position[i0 + 1], g.position[i1 + 2] - g.position[i0 + 2]]
    const e2 = [g.position[i2] - g.position[i0], g.position[i2 + 1] - g.position[i0 + 1], g.position[i2 + 2] - g.position[i0 + 2]]
    outward +=
      (e1[1] * e2[2] - e1[2] * e2[1]) * (g.position[i0] + g.position[i1] + g.position[i2]) / 3 +
      (e1[2] * e2[0] - e1[0] * e2[2]) * (g.position[i0 + 1] + g.position[i1 + 1] + g.position[i2 + 1]) / 3 +
      (e1[0] * e2[1] - e1[1] * e2[0]) * (g.position[i0 + 2] + g.position[i1 + 2] + g.position[i2 + 2]) / 3
  }
  const c = g.bounds.center
  check('winding hacia afuera', outward > 0, `sum ${outward.toExponential(2)}`)
  void c

  // Presupuesto de vértices.
  const limit = tier === 'high' ? 20000 : 9000
  check(`presupuesto de vértices (≤ ${limit})`, g.vertexCount <= limit, `${g.vertexCount}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Renders ASCII con z-buffer.
// ─────────────────────────────────────────────────────────────────────────────

function renderAscii(g, W, H, azDeg, elDeg, opts = {}) {
  const { flat = false, mode = 'solid' } = opts
  const az = (azDeg * Math.PI) / 180
  const el = (elDeg * Math.PI) / 180
  // base de la cámara (mirando hacia el origen)
  const fwd = [-Math.sin(az) * Math.cos(el), -Math.sin(el), -Math.cos(az) * Math.cos(el)]
  const right = [Math.cos(az), 0, -Math.sin(az)]
  const up = [
    right[1] * fwd[2] - right[2] * fwd[1],
    right[2] * fwd[0] - right[0] * fwd[2],
    right[0] * fwd[1] - right[1] * fwd[0],
  ]

  const b = g.bounds
  const ext = Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2])
  const scale = (Math.min(W, H * 2.2) * 0.46) / ext

  // Centro de la silueta: se usa el punto medio del bbox en planta y el
  // tercio superior en altura, que es lo que la cámara 3/4 encuadra.
  const ctr = [
    (b.min[0] + b.max[0]) / 2,
    b.min[1] + (b.max[1] - b.min[1]) * 0.42,
    (b.min[2] + b.max[2]) / 2,
  ]

  const zb = new Float64Array(W * H).fill(Infinity)
  const lum = new Float64Array(W * H).fill(-1)

  const key = [-0.45, 0.78, 0.44]
  const kl = Math.hypot(...key)
  const keyDir = key.map((v) => v / kl)

  // Sin Math.round: redondear a píxel entero destruye los triángulos
  // sub-píxel (área → 0) y el modelo se rasteriza casi vacío.
  const project = (x, y, z) => {
    const px = x - ctr[0], py = y - ctr[1], pz = z - ctr[2]
    const sx = px * right[0] + py * right[1] + pz * right[2]
    const sy = px * up[0] + py * up[1] + pz * up[2]
    const depth = px * fwd[0] + py * fwd[1] + pz * fwd[2]
    return [W / 2 + sx * scale, H / 2 - sy * scale, depth]
  }

  const P = g.position
  let triArea0 = 0
  let pxTried = 0
  let pxInside = 0
  if (mode === 'wire') {
    // Wireframe con z-buffer: cada arista se dibuja con Bresenham. A diferencia
    // del sombreado, no depende del área proyectada, así que muestra la
    // estructura real aunque los triángulos sean astillas.
    // `shade` hay que pasarlo: la closure de `edge` está en el bloque exterior y
    // no ve las `const` declaradas dentro del bucle.
    const edge = (v0, v1, shade) => {
      const a = project(...v0)
      const b = project(...v1)
      const steps = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])))
      for (let s = 0; s <= steps; s++) {
        const t = s / steps
        const x = Math.round(a[0] + (b[0] - a[0]) * t)
        const y = Math.round(a[1] + (b[1] - a[1]) * t)
        if (x < 0 || x >= W || y < 0 || y >= H) continue
        const depth = a[2] + (b[2] - a[2]) * t
        const o = y * W + x
        if (depth < zb[o]) {
          zb[o] = depth
          lum[o] = shade
        }
      }
    }
    for (let t = 0; t < g.triangleCount * 3; t += 3) {
      const i0 = g.index[t] * 3, i1 = g.index[t + 1] * 3, i2 = g.index[t + 2] * 3
      const v0 = [P[i0], P[i0 + 1], P[i0 + 2]]
      const v1 = [P[i1], P[i1 + 1], P[i1 + 2]]
      const v2 = [P[i2], P[i2 + 1], P[i2 + 2]]
      const n = [
        (v1[1] - v0[1]) * (v2[2] - v0[2]) - (v1[2] - v0[2]) * (v2[1] - v0[1]),
        (v1[2] - v0[2]) * (v2[0] - v0[0]) - (v1[0] - v0[0]) * (v2[2] - v0[2]),
        (v1[0] - v0[0]) * (v2[1] - v0[1]) - (v1[1] - v0[1]) * (v2[0] - v0[0]),
      ]
      const nl = Math.hypot(...n) || 1
      const nrm = [n[0] / nl, n[1] / nl, n[2] / nl]
      const dd = Math.max(0, nrm[0] * keyDir[0] + nrm[1] * keyDir[1] + nrm[2] * keyDir[2])
      const shade = flat ? 0.45 + 0.55 * nrm[1] : 0.18 + 0.82 * dd
      if (Math.abs(n[0]) + Math.abs(n[1]) + Math.abs(n[2]) < 1e-9) continue
      edge(v0, v1, shade)
      edge(v1, v2, shade)
      edge(v0, v2, shade)
    }
  } else {
    for (let t = 0; t < g.triangleCount * 3; t += 3) {
    const i0 = g.index[t] * 3, i1 = g.index[t + 1] * 3, i2 = g.index[t + 2] * 3
    const v0 = [P[i0], P[i0 + 1], P[i0 + 2]]
    const v1 = [P[i1], P[i1 + 1], P[i1 + 2]]
    const v2 = [P[i2], P[i2 + 1], P[i2 + 2]]
    const n = [
      (v1[1] - v0[1]) * (v2[2] - v0[2]) - (v1[2] - v0[2]) * (v2[1] - v0[1]),
      (v1[2] - v0[2]) * (v2[0] - v0[0]) - (v1[0] - v0[0]) * (v2[2] - v0[2]),
      (v1[0] - v0[0]) * (v2[1] - v0[1]) - (v1[1] - v0[1]) * (v2[0] - v0[0]),
    ]
    const nl = Math.hypot(...n) || 1
    const nrm = [n[0] / nl, n[1] / nl, n[2] / nl]
    let shade
    if (flat) {
      shade = 0.5 + 0.5 * nrm[1]
    } else {
      const d = Math.max(0, nrm[0] * keyDir[0] + nrm[1] * keyDir[1] + nrm[2] * keyDir[2])
      const rim = Math.pow(1 - Math.abs(d), 2) * 0.35
      shade = 0.12 + 0.88 * d + rim
    }

    const a = project(...v0)
    const bb = project(...v1)
    const cc = project(...v2)
    const area = (bb[0] - a[0]) * (cc[1] - a[1]) - (cc[0] - a[0]) * (bb[1] - a[1])
    if (Math.abs(area) < 1e-9) { triArea0++; continue }
    // La proyección es flotante, así que los límites de la caja hay que
    // redondearlos hacia dentro: si no, y*W+x deja de ser un índice entero.
    const minX = Math.max(0, Math.floor(Math.min(a[0], bb[0], cc[0])))
    const maxX = Math.min(W - 1, Math.ceil(Math.max(a[0], bb[0], cc[0])))
    const minY = Math.max(0, Math.floor(Math.min(a[1], bb[1], cc[1])))
    const maxY = Math.min(H - 1, Math.ceil(Math.max(a[1], bb[1], cc[1])))
    if (minX > maxX || minY > maxY) continue
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        pxTried++
        const px = x + 0.5, py = y + 0.5
        const w0 = ((bb[0] - a[0]) * (py - a[1]) - (px - a[0]) * (bb[1] - a[1])) / area
        const w1 = ((px - a[0]) * (cc[1] - a[1]) - (cc[0] - a[0]) * (py - a[1])) / area
        if (w0 < 0 || w1 < 0 || w0 + w1 > 1) continue
        pxInside++
        const depth = a[2] + w1 * (bb[2] - a[2]) + w0 * (cc[2] - a[2])
        const o = y * W + x
        if (depth < zb[o]) {
          zb[o] = depth
          lum[o] = shade
        }
      }
    }
    }
  }

  const RAMP = ' .:-=+*#%@'
  const out = []
  let lit = 0
  for (let y = 0; y < H; y++) {
    let line = ''
    for (let x = 0; x < W; x++) {
      const l = lum[y * W + x]
      if (l < 0) { line += ' '; continue }
      lit++
      const k = Math.max(0, Math.min(RAMP.length - 1, Math.round(l * (RAMP.length - 1))))
      line += RAMP[k]
    }
    out.push(line)
  }
  // Diagnóstico opt-in: si el dibujo se ve mal, esto dice si la geometría no
  // proyecta donde debería o si el rasterizador se está comiendo triángulos.
  if (process.env.ROSE_VERBOSE) {
    let sxn = Infinity, sxx = -Infinity, syn = Infinity, sxy = -Infinity
    for (let i = 0; i < g.vertexCount; i++) {
      const s = project(g.position[i * 3], g.position[i * 3 + 1], g.position[i * 3 + 2])
      sxn = Math.min(sxn, s[0]); sxx = Math.max(sxx, s[0])
      syn = Math.min(syn, s[1]); sxy = Math.max(sxy, s[1])
    }
    let dxn = Infinity, dxx = -Infinity, dyn = Infinity, dxy = -Infinity
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (lum[y * W + x] < 0) continue
        dxn = Math.min(dxn, x); dxx = Math.max(dxx, x)
        dyn = Math.min(dyn, y); dxy = Math.max(dxy, y)
      }
    }
    console.error(
      `   [${mode}] px=${lit}/${W * H}  vértices x[${sxn.toFixed(0)},${sxx.toFixed(0)}] y[${syn.toFixed(0)},${sxy.toFixed(0)}]` +
      `  dibujado x[${dxn},${dxx}] y[${dyn},${dxy}]  escala=${scale.toFixed(2)} ext=${ext.toFixed(1)}` +
      `  tri=${g.triangleCount} area0=${triArea0} probados=${pxTried} dentro=${pxInside}`,
    )
  }
  return out.join('\n')
}

// Para juzgar la FORMA el ASCII necesita una malla cuya densidad de triángulos
// case con la resolución del lienzo: 22 848 triángulos sobre 1 800 píxeles dan
// astillas de 0.08 px² que casi nunca contienen el centro de un píxel. Aquí
// se usa la misma forma con menos columnas por pétalo, que para una silueta
// es indistinguible y para el rasterizador es legible.
section('5 · Render ASCII — 3/4 (el que se ve en pantalla)')
console.log(renderAscii(preview, 150, 74, 34, 24))

section('6 · Render ASCII — 3/4 bajo (perfil)')
console.log(renderAscii(preview, 150, 52, 68, 6))

section('7 · Render ASCII — cenital (silueta de rosa)')
console.log(renderAscii(preview, 90, 60, 0, 86, { flat: true }))

section('8 · Render ASCII — mobile 360×640, 3/4')
console.log(renderAscii(preview, 96, 62, 30, 22))

// ─────────────────────────────────────────────────────────────────────────────
section('Resumen')
console.log(`${checks - failures}/${checks} comprobaciones correctas`)
if (failures > 0) {
  console.log(`\x1b[31m${failures} FALLO(S)\x1b[0m`)
  process.exit(1)
}
console.log('\x1b[32mGate 0 superado.\x1b[0m')
