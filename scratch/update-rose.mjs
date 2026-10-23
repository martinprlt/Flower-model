import { readFileSync, writeFileSync } from 'node:fs'

const original = readFileSync('src/math/rose.ts', 'utf8')

// The replacement code for rose.ts
const newCode = `/**
 * rose.ts — La matemática de la rosa (Iteración 2: Realismo Visual).
 *
 * Este módulo NO importa three.js. Sólo devuelve números y typed arrays, de
 * modo que la geometría puede validarse en Node sin navegador y puede
 * modificarse sin tocar una sola línea de render.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  INTERPRETACIÓN DE LAS ECUACIONES (CONSERVADAS)
 * ─────────────────────────────────────────────────────────────────────────
 *
 *  1) φ(θ) = (π/2)·e^(−θ/8π)
 *
 *     Es monótona y estrictamente decreciente: φ(0) = 90°, φ(∞) = 0°.
 *     La leemos como el ÁNGULO DE ELEVACIÓN del plano de cada pétalo respecto
 *     del suelo. φ = 90° ⇒ pétalo vertical (capullo cerrado). φ = 0° ⇒
 *     pétalo horizontal (totalmente abierto). Como θ crece hacia afuera, los
 *     pétalos interiores quedan casi verticales y los exteriores casi
 *     horizontales, que es exactamente la anatomía de una rosa.
 *
 *     CONVENCIÓN DE SIGNO:
 *     φ es el ángulo de elevación del plano del pétalo, y la espina SUBE a
 *     lo largo de él: ψ = 90° ⇒ el pétalo es vertical y el capullo crece
 *     hacia arriba; ψ = 0° ⇒ el pétalo es horizontal; ψ < 0 ⇒ el pétalo se
 *     curva hacia abajo. La anatomía de una rosa es exactamente esa
 *     secuencia, así que ψ = φ − phiDrop·kh² (phiDrop > 0) deja el centro
 *     vertical en el centro y el borde colgando, que es como se abre una rosa
 *     de verdad.
 *
 *  2) X(θ) = 1 − ½·[ (5/4)·(1 − (θ mod 2π)/π)² − ¼ ]²
 *
 *     NO es una rosa multipétalo. Verificado numéricamente sobre 400 000
 *     muestras de un período:
 *       · rango          [0.5, 1.0]
 *       · dos crestas    en θ/π = 1 ± 1/√5, ambas con X = 1
 *       · valle interior θ = π, X = 0.96875 (cintura de 3.1 %)
 *       · cúspide en θ = 2π, con pendiente ∓2.5 en u (no es derivable)
 *     Es decir: un perfil de UN pétalo, con su meseta plana y su cúspide justo
 *     en la costura del período.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  MEJORAS DE LA ITERACIÓN 2
 * ─────────────────────────────────────────────────────────────────────────
 *  · Integración de la tangente para la espina: r(q) y h(q) salen de integrar
 *    numéricamente (Gauss-Legendre) el vector unitario (cosψ, sinψ). La
 *    tangente de la curva coincide EXACTAMENTE con e1, eliminando pliegues,
 *    pellizcos y discontinuidades.
 *  · Capullo central compacto: pétalos internos que nacen en el ápice
 *    (rbMin = 0.25) y se enrollan helicoidalmente alrededor del eje vertical,
 *    eliminando el hueco negro y cerrando el centro.
 *  · Anatomía orgánica: bordes scalloped (arqueados longitudinalmente),
 *    sutil ondulación de borde (ruffle), cuenco dished y márgenes reflejos.
 *  · Verticilos imbricados: 5 anillos con solapamiento amplio (30–45 %),
 *    evitando cualquier hendidura entre capas.
 *  · Subdivisiones longitudinales equilibradas (qSeg de 8 a 12).
 * ─────────────────────────────────────────────────────────────────────────
 */

export const TAU = Math.PI * 2
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)) // 2.39996322972865332

export type Vec3 = [number, number, number]
export type Tier = 'low' | 'mid' | 'high'

export interface RoseParams {
  /** Número de pétalos de la flor. */
  petals: number
  /** Segmentos a lo largo de la espina de cada pétalo. */
  qSeg: number
  /** Segmentos alrededor de la sección transversal de cada pétalo. */
  arcSeg: number

  /** Número de verticilos (anillos). */
  whorls: number
  /** Exponente de crecimiento de verticilos hacia afuera. */
  whorlExp: number

  /** θ en el pétalo exterior. */
  thetaMap: number
  /** Exponente de elevación. */
  phiExp: number

  /** Cúpula del receptáculo. */
  chiMax: number
  rbMin: number
  rbMax: number
  yTop: number
  yDrop: number

  /** Caída del borde (rad). */
  phiDrop: number
  /** Reflejo longitudinal (rad). */
  curl: number
  curlExp: number

  /** Longitud del pétalo. */
  l0: number
  lBias: number
  lExp: number
  rExp: number
  hExp: number

  /** Semiancho y perfil. */
  wFrac: number
  wMin: number
  wTip: number
  ringExp: number
  cup: number
  psiClosed: number
  psiOpen: number

  /** Ondulación y torsión deterministas. */
  azJit: number
  tw0: number
  tw1: number
  tw2: number
}

const SHAPE = {
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
  rExp: 0.85,
  hExp: 0.7,
  wFrac: 0.54,
  wMin: 0.35,
  wTip: 0.45,
  ringExp: 0.45,
  cup: 0.48,
  psiOpen: 0.64 * Math.PI,
  azJit: 0.18,
  tw0: 0.08,
  tw1: 0.35,
  tw2: 0.20,
} as const

const RESOLUTION = {
  low: { petals: 26, qSeg: 8, arcSeg: 30 },
  mid: { petals: 30, qSeg: 10, arcSeg: 28 },
  high: { petals: 34, qSeg: 12, arcSeg: 46 },
} as const

export const ROSE_PARAMS: Readonly<Record<Tier, Readonly<RoseParams>>> = {
  low: { ...SHAPE, ...RESOLUTION.low, psiClosed: TAU * 0.88 },
  mid: { ...SHAPE, ...RESOLUTION.mid, psiClosed: TAU * 0.88 },
  high: { ...SHAPE, ...RESOLUTION.high, psiClosed: TAU * 0.88 },
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

export const THETA_MIN = 0
export const THETA_MAX = (petals: number) => TAU * petals
export const THETA_SEGMENTS = (p: RoseParams) => p.petals * p.qSeg
export const RADIAL_SEGMENTS = (p: RoseParams) => p.arcSeg

/** φ(θ) = (π/2)·e^(−θ/8π) — ecuación original, sin modificar. */
export function rosePhi(theta: number): number {
  return (Math.PI / 2) * Math.exp(-theta / (8 * Math.PI))
}

/** X(θ) = 1 − ½·[(5/4)(1 − (θ mod 2π)/π)² − ¼]² — ecuación original, sin modificar. */
export function roseX(theta: number): number {
  const u = ((((theta % TAU) + TAU) % TAU) / Math.PI) as number
  const g = 1.25 * (1 - u) * (1 - u) - 0.25
  return 1 - 0.5 * g * g
}

/** θ = 2π(n + q/2) — argumento de X para el pétalo n en la fracción q. */
export function roseTheta(n: number, q: number): number {
  return TAU * (n + 0.5 * q)
}

/** X normalizado a [0,1]; 0 en la costura entre pétalos, 1 en la meseta. */
export function roseXNorm(theta: number): number {
  return (roseX(theta) - 0.5) / 0.5
}

/** kh ∈ [0,1]: posición normalizada del pétalo, 0 = centro, 1 = borde. */
export function roseK(p: RoseParams, n: number): number {
  return clamp01(n / p.petals)
}

export interface RoseWhorl {
  k: number
  j: number
  m: number
  kh: number
  rot: number
}

interface WhorlTable {
  whorlOf: Int32Array
  jOf: Int32Array
  count: Int32Array
  kh: Float64Array
  rot: Float64Array
}

const whorlTables = new Map<string, WhorlTable>()

function whorlTable(p: RoseParams): WhorlTable {
  const key = \`\${p.petals}:\${p.whorls}:\${p.whorlExp}\`
  const hit = whorlTables.get(key)
  if (hit) return hit

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
    const weights: number[] = []
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

  const table: WhorlTable = { whorlOf, jOf, count, kh, rot }
  whorlTables.set(key, table)
  return table
}

export function roseWhorl(p: RoseParams, n: number): RoseWhorl {
  const t = whorlTable(p)
  const idx = Math.min(p.petals - 1, Math.max(0, Math.floor(n)))
  const k = t.whorlOf[idx]
  return { k, j: t.jOf[idx], m: t.count[k], kh: t.kh[k], rot: t.rot[k] }
}

function petalHash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return (s - Math.floor(s)) * 2 - 1
}

export function roseElevation(p: RoseParams, kh: number): number {
  return rosePhi(p.thetaMap * Math.pow(kh, p.phiExp)) - p.phiDrop * kh * kh
}

export function rosePhiPetal(p: RoseParams, n: number): number {
  return roseElevation(p, roseWhorl(p, n).kh)
}

export interface RoseSpine {
  r: number
  h: number
  l: number
  w: number
  phi: number
  sinPhi: number
  cosPhi: number
  beta: number
  cosBeta: number
  sinBeta: number
  psiMax: number
  kh: number
  q: number
}

// Cuadratura de Gauss-Legendre de 5 puntos para integrar la dirección tangente
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

export function roseSpine(p: RoseParams, n: number, q: number): RoseSpine {
  const wh = roseWhorl(p, n)
  const khw = wh.kh
  const hash = petalHash(n)

  const psi0 = roseElevation(p, khw) + 0.04 * hash
  const curlAmt = p.curl * Math.pow(khw, p.curlExp)
  const psi = psi0 - curlAmt * q * q
  const sinPhi = Math.sin(psi)
  const cosPhi = Math.cos(psi)

  // Cúpula del receptáculo: rbMin = 0.25 para que el capullo central nazca desde el ápice
  const chi = p.chiMax * khw
  const rBase = p.rbMin + (p.rbMax - p.rbMin) * Math.sin(chi)
  const hBase = p.yTop - p.yDrop * (1 - Math.cos(chi))

  const l = p.l0 * (p.lBias + (1 - p.lBias) * Math.pow(khw, p.lExp)) * (1 + 0.05 * hash)

  // INTEGRACIÓN DE LA TANGENTE:
  // r(q) = rBase + l · ∫_0^q cos(ψ(s)) ds
  // h(q) = hBase + l · ∫_0^q sin(ψ(s)) ds
  // Garantiza que el vector tangente de la espina sea unitario y colineal con e1
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

  // Semiancho generoso y natural: solapamiento imbricado entre pétalos adyacentes
  const isBud = Math.max(0, 1 - khw / 0.5)
  const budWidth = isBud * isBud * 0.8
  const baseWidth = l * p.wFrac * (0.35 + 0.65 * Math.sin(Math.pow(q, 0.7) * Math.PI))
  const outerWidth = l * p.wFrac * (p.wTip + (1 - p.wTip) * q) * (0.55 + 0.45 * khw)
  const xn = roseXNorm(roseTheta(n, q))
  const targetW = Math.max(baseWidth, outerWidth) * (1 + budWidth) * (0.45 + 0.55 * xn)
  const w = Math.max(p.wMin, targetW)

  // Torsión espiral del capullo: los pétalos centrales se enrollan helicoidalmente
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

export interface Frame {
  ex: number
  ey: number
  ez: number
  ax: number
  ay: number
  az: number
  bx: number
  by: number
  bz: number
}

export function roseFrame(s: RoseSpine): Frame {
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

export function rosePosition(p: RoseParams, n: number, q: number, a: number, out: Vec3): Vec3 {
  const s = roseSpine(p, n, q)
  const f = roseFrame(s)
  return rosePositionFromSpine(p, s, f, a, out)
}

export function rosePositionFromSpine(
  p: RoseParams,
  s: RoseSpine,
  f: Frame,
  a: number,
  out: Vec3,
): Vec3 {
  const u = 2 * a - 1
  const psi = u * (s.psiMax * 0.5)
  const sinPsi = Math.sin(psi)
  const cosPsi = Math.cos(psi)

  // Perfil del pétalo: base cerrada a un punto (ring) y borde arqueado
  const ring = Math.sin(Math.pow(s.q, p.ringExp) * Math.PI * 0.5)
  const tipArch = 1 - 0.22 * (u * u) * s.q
  const edgeRuffle = p.azJit * 0.28 * Math.sin(u * Math.PI * 3 + s.kh * 7) * Math.pow(s.q, 2) * Math.pow(s.kh, 1.2)

  const lat = s.w * ring * sinPsi * (1 + edgeRuffle)

  // Cuenco profundo y reflejo de los márgenes en pétalos abiertos
  const reflex = 0.28 * Math.pow(s.kh, 1.5) * Math.pow(s.q, 2) * Math.pow(Math.abs(u), 3)
  const dep = (p.cup * cosPsi - reflex) * s.w * ring * tipArch

  // Retracción de la silueta en los extremos laterales (contorno suave obovado)
  const archPull = -0.16 * (u * u) * s.l * Math.pow(s.q, 1.5)
  const e1x = f.ex * archPull
  const e1y = f.ey * archPull
  const e1z = f.ez * archPull

  // Rodrigues twist
  const t = p.tw0 * s.kh + p.tw1 * s.kh * s.q + p.tw2 * s.kh * s.q * s.q
  const ct = Math.cos(t)
  const st = Math.sin(t)

  const A2x = f.ax * ct + f.bx * st
  const A2y = f.ay * ct + f.by * st
  const A2z = f.az * ct + f.bz * st
  const A3x = -f.ax * st + f.bx * ct
  const A3y = -f.ay * st + f.by * ct
  const A3z = -f.az * st + f.bz * ct

  // Envoltura cilíndrica del capullo: para los pétalos centrales, la sección lateral
  // se curva alrededor del eje vertical en lugar de dispararse en plano tangente
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

export function roseProgress(p: RoseParams, n: number, q: number): number {
  return clamp01(
    0.86 * (n / p.petals) + 0.14 * q + 0.04 * Math.sin(n * GOLDEN_ANGLE),
  )
}

export function rosePetalIndex(p: RoseParams, n: number, q: number): number {
  return clamp01((n + q) / p.petals)
}

export interface RoseBounds {
  min: Vec3
  max: Vec3
  center: Vec3
  radius: number
  aspect: number
}

export interface RoseArrays {
  position: Float32Array
  normal: Float32Array
  uv: Float32Array
  aProgress: Float32Array
  aPetal: Float32Array
  index: Uint32Array
  vertexCount: number
  triangleCount: number
  rows: number
  cols: number
  bounds: RoseBounds
  core: Vec3
}

export interface BuildOptions {
  skipNormalize?: boolean
}

export function buildRoseArrays(
  p: RoseParams,
  opts: BuildOptions = {},
): RoseArrays {
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

  const qOf = (row: number) => (row % p.qSeg) / Math.max(1, p.qSeg - 1)
  const aOf = (col: number) => col / p.arcSeg

  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  const p0: Vec3 = [0, 0, 0]

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

  // Normales por diferencias centrales acotadas al propio pétalo
  const tu: Vec3 = [0, 0, 0]
  const tv: Vec3 = [0, 0, 0]

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

        const nx = tu[1] * tv[2] - tu[2] * tv[1]
        const ny = tu[2] * tv[0] - tu[0] * tv[2]
        const nz = tu[0] * tv[1] - tu[1] * tv[0]
        const len = Math.hypot(nx, ny, nz)
        if (len < 1e-6) {
          const sp = roseSpine(p, n, 0)
          const fr = roseFrame(sp)
          normal[vi * 3] = fr.bx
          normal[vi * 3 + 1] = fr.by
          normal[vi * 3 + 2] = fr.bz
        } else {
          normal[vi * 3] = nx / len
          normal[vi * 3 + 1] = ny / len
          normal[vi * 3 + 2] = nz / len
        }
      }
    }
  }

  // Orientación POR PÉTALO
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
  const center: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]
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
    bounds: {
      min,
      max,
      center,
      radius,
      aspect: d / Math.max(h, 1e-4),
    },
    core: [0, min[1] + (max[1] - min[1]) * 0.45, 0],
  }
}
`

writeFileSync('src/math/rose.ts', newCode, 'utf8')
console.log('src/math/rose.ts updated successfully!')
