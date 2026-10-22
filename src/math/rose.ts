/**
 * rose.ts — La matemática de la rosa.
 *
 * Este módulo NO importa three.js. Sólo devuelve números y typed arrays, de
 * modo que la geometría puede validarse en Node sin navegador y puede
 * modificarse sin tocar una sola línea de render.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  INTERPRETACIÓN DE LAS ECUACIONES
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
 *     (Curiosidad: integrando dR/dθ = cos φ, dH/dθ = sin φ se obtiene
 *     R(θ) = 8π·[Ci(π/2) − Ci(φ)], H(θ) = 8π·[Si(π/2) − Si(φ)]. O sea que φ
 *     es literalmente el ángulo tangente del perfil generador. No se usa para
 *     la geometría porque R(θ) crece como θ − 13.99, sin cota.)
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
 *     en la costura del período. Por eso θ = 2π(n + q) — exactamente un
 *     período por pétalo — y la cúspide cae en la unión entre pétalos, donde
 *     uno se esconde bajo el siguiente.
 *
 *  3) (x, y, z) = ( r·sin φ, r·cos φ, X(θ·cos φ − y·sin φ) )
 *
 *     Se descarta. Es inconsistente por tres motivos independientes:
 *       a) usa `y` antes de haberlo definido (está en ambos lados del mismo
 *          par ordenado: circular);
 *       b) resta un ángulo (θ·cos φ) a una coordenada (y·sin φ): unidades
 *          incompatibles;
 *       c) toma X(...) como z directamente, con X ∈ [0.5, 1] ⇒ un disco
 *          ondulado de media unidad de alto, sin número de pétalos y con `r`
 *          nunca asignado. Es justamente el resultado que había que evitar.
 *
 *     Sustituto coherente: elipse de sépalos sobre un domo en espiral
 *     filotáxica (ángulo áureo 137.507°, que es el empaquetamiento más denso
 *     posible y el orden real en que los pétalos de una rosa se distribuyen).
 *     Cada pétalo n es una cáscara cóncava —un "cuenco" aplanado— barrida a lo
 *     largo de una espina cónica; el barrido completo (ψmax = 2π) cerca del
 *     centro sella el capullo, y un barrido parcial (0.58π) en el borde deja
 *     ver el interior del pétalo.
 * ─────────────────────────────────────────────────────────────────────────
 */

export const TAU = Math.PI * 2
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)) // 2.39996322972865332

export type Vec3 = [number, number, number]
export type Tier = 'low' | 'mid' | 'high'

export interface RoseParams {
  /** Número de pétalos de la espiral. */
  petals: number
  /** Segmentos a lo largo de la espina de cada pétalo. */
  qSeg: number
  /** Segmentos alrededor de la sección transversal de cada pétalo. */
  arcSeg: number

  /** θ con el que se evalúa φ en el pétalo exterior. El knob de "cuánto abre". */
  thetaMap: number
  /** Exponente que reparte los pétalos entre el centro y el borde. */
  phiExp: number

  /**
   * Perfil del receptáculo: una CÚPULA, no un cono. El ángulo polar χ va de 0
   * (cima) a chiMax (borde) y de ahí salen el radio y la altura de la base de
   * cada pétalo. Un perfil cónico —bases alineadas en una vertical— produce
   * exactamente la silueta que no queremos: un cucurucho.
   */
  chiMax: number
  rbMin: number
  rbMax: number
  yTop: number
  yDrop: number

  /** Longitud del pétalo: l0·(bias + (1−bias)·kh^exp). */
  l0: number
  lBias: number
  lExp: number
  /** Curl: la punta cae más rápido de lo que avanza (hExp > rExp). */
  rExp: number
  hExp: number

  /** Semiancho de la sección, proporcional a la longitud del pétalo. */
  wFrac: number
  wMin: number
  wTip: number
  /** Exponente del perfil que abre el pétalo desde la base. */
  ringExp: number
  /** Profundidad del cuenco como fracción del semiancho. */
  cup: number
  /** Barrido angular de la sección: 2π (tubo sellado) → 0.58π (cuenco). */
  psiClosed: number
  psiOpen: number

  /** Ondulación determinista del borde del pétalo (radianes). */
  azJit: number
  /** Torcer la sección sobre la espina: t = tw0·kh + tw1·kh·q + tw2·kh·q². */
  tw0: number
  tw1: number
  tw2: number
}

/**
 * Parámetros de FORMA. Idénticos en los tres tiers: cambiar la resolución no
 * debe cambiar la rosa, sólo cuántos triángulos la describen.
 *
 *  · thetaMap, phiExp  φ: 90° en el centro → ~26° en el borde
 *  · chiMax..yDrop     cúpula del receptáculo (radio y altura de las bases)
 *  · l0, lBias, lExp   longitud del pétalo: corta y erguida en el centro,
 *                      larga y abierta en el borde
 *  · hExp > rExp       la punta cae más rápido de lo que avanza ⇒ se recurre
 *  · wFrac, wTip, wMin semiancho, proporcional a l0 (si el semiancho Depends
 *                      del radio global, los 18 pétalos interiores se quedan
 *                      todos clavados en wMin y amontonan el 60 % de los
 *                      vértices en un radio de 2)
 *  · ringExp           el pétalo nace de un punto; menor ⇒ se abre antes
 *  · cup               profundidad del cuenco, como fracción del semiancho
 *  · psiOpen           barrido angular en el borde (2π = tubo casi sellado)
 *  · azJit, tw0..tw2   ondulación y torcimiento deterministas
 */
const SHAPE = {
  // φ va de 90° en el centro a ~12° en el borde. thetaMap/phiExp juntos
  // controlan DÓNDE se abre: con phiExpa = 2.2 la apertura se concentra en
  // el último tercio, que es como se abre una rosa de verdad (el centro queda
  //erguido y el borde se extiende casi en horizontal). Con phiExp = 1.25 el
  // pétalo se abría a medio camino y el perfil lateral salía un embudo.
  thetaMap: 50,
  phiExp: 2.2,
  chiMax: 1.55,
  rbMin: 2,
  rbMax: 6,
  yTop: 20.4,
  yDrop: 20,
  l0: 13,
  lBias: 0.16,
  lExp: 1.4,
  rExp: 0.85,
  hExp: 1.4,
  wFrac: 0.42,
  wMin: 0.35,
  wTip: 0.45,
  ringExp: 0.6,
  cup: 0.5,
  psiOpen: 0.62 * Math.PI,
  azJit: 0.22,
  tw0: 0.08,
  tw1: 0.45,
  tw2: 0.25,
} as const

/** Sólo resolución. El mismo modelo, triangulado con distinto detalle. */
const RESOLUTION = {
  low: { petals: 26, qSeg: 2, arcSeg: 44 },
  mid: { petals: 30, qSeg: 3, arcSeg: 72 },
  high: { petals: 34, qSeg: 4, arcSeg: 112 },
} as const

export const ROSE_PARAMS: Readonly<Record<Tier, Readonly<RoseParams>>> = {
  low: { ...SHAPE, ...RESOLUTION.low, psiClosed: TAU },
  mid: { ...SHAPE, ...RESOLUTION.mid, psiClosed: TAU },
  high: { ...SHAPE, ...RESOLUTION.high, psiClosed: TAU },
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/**
 * Nombres explícitos del dominio y de la discretización, como pide el
 * enunciado. El dominio no es continuo: θ avanza una vuelta completa (2π) por
 * cada pétalo, así que θ ∈ [0, 2π·petals].
 */
export const THETA_MIN = 0
export const THETA_MAX = (petals: number) => TAU * petals
/** Segmentos a lo largo de θ (filas del cuerpo de la malla). */
export const THETA_SEGMENTS = (p: RoseParams) => p.petals * p.qSeg
/** Segmentos alrededor de la sección transversal (columnas de la malla). */
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

/**
 * θ = 2π(n + q/2) — el argumento de X para el pétalo n en la fracción q.
 *
 * Con θ = 2π(n + q) X completaba un período entero por pétalo, pero su
 * período empieza y acaba en la CÚSPIDE (X = 0.5), así que el semiancho del
 * pétalo era cero en la base y cero otra vez en la punta: una hoja de weakest
 * —una espada de hierba— en vez de un pétalo.
 *
 * Recorrer SÓLO la mitad del período (u de 0 a ½) invierte el roles: la
 * cúspide cae en la base, donde el perfil `ring` ya cierra el pétalo a un
 * punto, y la cresta cae en la punta, que es justo donde un pétalo tiene que
 * ser ancho. X deja de ser simétrico y pasa a ser el flanco monótono del
 * contorno. Estructuralmente sigue marcando la costura entre pétalos.
 */
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

/** Elevación del pétalo n: de 90° en el centro a ~30° en el borde. */
export function rosePhiPetal(p: RoseParams, n: number): number {
  return rosePhi(p.thetaMap * Math.pow(roseK(p, n), p.phiExp))
}

export interface RoseSpine {
  /** Posición de la espina en el plano del suelo. */
  r: number
  /** Altura de la espina. */
  h: number
  /** Longitud total del pétalo. */
  l: number
  /** Semiancho de la sección en este punto. */
  w: number
  /** phi, sen y cos del plano del pétalo. */
  phi: number
  sinPhi: number
  cosPhi: number
  /** Azimut de la espina. */
  beta: number
  cosBeta: number
  sinBeta: number
  /** Barrido angular de la sección. */
  psiMax: number
  kh: number
  /** Fracción de la espina en la que se evaluó este punto. */
  q: number
}

/**
 * Espina del pétalo n en la fracción q de su longitud.
 * Es la única pieza que se comparte entre la superficie y el casquete.
 */
export function roseSpine(p: RoseParams, n: number, q: number): RoseSpine {
  const kh = roseK(p, n)
  const phi = rosePhi(p.thetaMap * Math.pow(kh, p.phiExp))
  const sinPhi = Math.sin(phi)
  const cosPhi = Math.cos(phi)

  // Cúpula del receptáculo: las bases de los pétalos se reparten por una
  // cúpula, de modo que el contorno de la flor abomba en el medio en vez de
  // ser una recta del ápice al borde.
  const chi = p.chiMax * kh
  const rBase = p.rbMin + (p.rbMax - p.rbMin) * Math.sin(chi)
  const hBase = p.yTop - p.yDrop * (1 - Math.cos(chi))

  const l = p.l0 * (p.lBias + (1 - p.lBias) * Math.pow(kh, p.lExp))

  const r = rBase + l * Math.pow(q, p.rExp) * cosPhi
  const h = hBase - l * Math.pow(q, p.hExp) * sinPhi

  // El semiancho escala con l0 y no con el radio global: así el pétalo
  // exterior es ancho porque es largo, y el interior angosto porque es corto.
  const xn = roseXNorm(roseTheta(n, q))
  const w = Math.max(
    p.wMin,
    p.l0 *
      p.wFrac *
      (p.wTip + (1 - p.wTip) * q) *
      (0.35 + 0.65 * kh) *
      (0.25 + 0.75 * xn),
  )

  const beta =
    n * GOLDEN_ANGLE + p.azJit * Math.sin(GOLDEN_ANGLE * q + 1.7) * Math.pow(kh, 1.2)

  return {
    r,
    h,
    l,
    w,
    phi,
    sinPhi,
    cosPhi,
    beta,
    cosBeta: Math.cos(beta),
    sinBeta: Math.sin(beta),
    psiMax: p.psiClosed + (p.psiOpen - p.psiClosed) * Math.pow(kh, 0.8),
    kh,
    q,
  }
}

/**
 * Base ortonormal de la sección, en forma cerrada (sin productos cruzados).
 *
 *   e1 = ( cosφ·cosβ,  −sinφ,  cosφ·sinβ)   dirección de la espina
 *   e2 = ( sinβ,        0,     −cosβ )      puramente tangencial
 *   e3 = ( sinφ·cosβ,   cosφ,  sinφ·sinβ)   dirección del cuenco
 *
 * Verificado: |e1| = |e2| = |e3| = 1, e1·e3 = cosφ·sinφ − sinφ·cosφ = 0 y
 * e3 × e2 = e1. Como φ ∈ (0°, 90°], cosφ ≠ 0 y e2 es siempre horizontal, no
 * existe ninguna orientación donde el marco se degenera. El marco "obvio"
 * e2 = up × e1 sí colapsa en φ = 90°, justo en el capullo.
 */
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
    // e1
    ex: cf * cb,
    ey: -sf,
    ez: cf * sb,
    // e2
    ax: sb,
    ay: 0,
    az: -cb,
    // e3
    bx: sf * cb,
    by: cf,
    bz: sf * sb,
  }
}

/**
 * Un punto de la flor.
 *   n  índice de pétalo (0 … petals)
 *   q  fracción de la espina, [0,1]
 *   a  fracción normalizada del barrido de la sección, [0,1]
 *
 * `a` DEBE ser una fracción normalizada y nunca un ángulo absoluto: psiMax
 * depende de n, así que barrer ψ directamente haría que s = 2a−1 se saliera de
 * [−1,1] y el término del cuenco explotara.
 */
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
  const psi = a * s.psiMax - s.psiMax * 0.5
  const sinPsi = Math.sin(psi)
  const cosPsi = Math.cos(psi)

  // El pétalo nace de un punto y se abre: base reducida a 0 en q = 0, boca
  // completa en q = 1. Es lo que hace que cada pétalo sea una hoja y no un
  // tubo, y además cierra el centro de la flor sin necesitar un casquete.
  const ring = Math.sin(Math.pow(s.q, p.ringExp) * Math.PI * 0.5)
  const lat = s.w * ring * sinPsi
  const dep = p.cup * s.w * ring * cosPsi

  // Torcer la sección sobre la espina (Rodrigues, válido porque e1×e2 = e3).
  const t = p.tw0 * s.kh + p.tw1 * s.kh * s.q + p.tw2 * s.kh * s.q * s.q
  const ct = Math.cos(t)
  const st = Math.sin(t)

  const A2x = f.ax * ct + f.bx * st
  const A2y = f.ay * ct + f.by * st
  const A2z = f.az * ct + f.bz * st
  const A3x = -f.ax * st + f.bx * ct
  const A3y = -f.ay * st + f.by * ct
  const A3z = -f.az * st + f.bz * ct

  const cx = s.r * s.cosBeta
  const cz = s.r * s.sinBeta

  out[0] = cx + A2x * lat - A3x * dep
  out[1] = s.h + A2y * lat - A3y * dep
  out[2] = cz + A2z * lat - A3z * dep
  return out
}

/**
 * φ(θ) — elevación del pétalo n: de 90° en el centro a ~30° en el borde.

/**
 * aProgress — el parámetro de crecimiento por vértice.
 * 0 = primera floración, 1 = última. Orden: centro → interiores → exteriores.
 * El 14 % de q escalona el despliegue a lo largo del propio pétalo, y el
 * solapamiento del 14 % entre pétalos evita que el florecimiento se vea a
 * saltos. El seno es una desviación determinista de ±4 %: nunca hay random().
 */
export function roseProgress(p: RoseParams, n: number, q: number): number {
  return clamp01(
    0.86 * (n / p.petals) + 0.14 * q + 0.04 * Math.sin(n * GOLDEN_ANGLE),
  )
}

/** aPetal — orden de crecimiento sin sesgar, para variación de color. */
export function rosePetalIndex(p: RoseParams, n: number, q: number): number {
  return clamp01((n + q) / p.petals)
}

export interface RoseBounds {
  min: Vec3
  max: Vec3
  center: Vec3
  radius: number
  /** cociente ancho/alto del bounding box. */
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
  /** Filas (q) y columnas (sección) de la malla. */
  rows: number
  cols: number
  bounds: RoseBounds
  /** El "corazón" de la flor: el eje del capullo de pétalos interiores. */
  core: Vec3
}

export interface BuildOptions {
  /** No normalizar a radio 1 (el validador lo necesita para medir d/h). */
  skipNormalize?: boolean
}

const EPS = 1e-4

// Vectores de trabajo reutilizados: buildRoseArrays se llama una vez por tier
// y no debe asignar ~16 000 objetos.
const tmp: Vec3 = [0, 0, 0]
const du: Vec3 = [0, 0, 0]
const dv: Vec3 = [0, 0, 0]
const tu: Vec3 = [0, 0, 0]
const tv: Vec3 = [0, 0, 0]

/**
 * Malla: `petals · qSeg` filas (q) por `arcSeg + 1` columnas (sección).
 *
 * TOPOLOGÍA — por qué los pétalos NO están unidos entre sí.
 * Cada pétalo va del eje (q = 0, un punto) al borde (q = 1, boca abierta).
 * Unir la punta del pétalo n con la base del n + 1 cruzaría toda la flor en
 * diagonal: un radio de 20 unidades de escombro atravesando el centro. En la
 * naturaleza no pasa eso, y por eso aquí tampoco: una rosa ES pétalos
 * superpuestos. El índice simplemente no crea quads entre el final de un
 * pétalo y el principio del siguiente, así que la geometría tiene `petals`
 * componentes conexas que se solapan. Con DoubleSide no se ve ningún hueco:
 * cada pétalo es una hoja cerrada en la base y abierta en la boca, que es
 * exactamente lo que es un pétalo real.
 *
 * Las normales salen de diferencias centrales de rosePosition (4 evaluaciones
 * por vértice, ~2 ms) y no de promediarlas, para no suavizar ni la cúspide de
 * X en la costura del pétalo ni el canto del cuenco.
 */
export function buildRoseArrays(
  p: RoseParams,
  opts: BuildOptions = {},
): RoseArrays {
  const cols = p.arcSeg + 1
  const rows = p.petals * p.qSeg
  const vertexCount = rows * cols
  const quadsPerPetal = (p.qSeg - 1) * p.arcSeg
  const triangleCount = p.petals * quadsPerPetal * 2

  const position = new Float32Array(vertexCount * 3)
  const normal = new Float32Array(vertexCount * 3)
  const uv = new Float32Array(vertexCount * 2)
  const aProgress = new Float32Array(vertexCount)
  const aPetal = new Float32Array(vertexCount)
  const index = new Uint32Array(triangleCount * 3)

  // Fila → (pétalo, posición sobre el pétalo). q recorre [0,1] con qSeg
  // muestras, así que la punta (q = 1) SÍ existe en el modelo.
  const petalOf = (row: number) => Math.floor(row / p.qSeg)
  const qOf = (row: number) => (row % p.qSeg) / (p.qSeg - 1)

  const at = (row: number, col: number, o: Vec3) =>
    rosePosition(p, petalOf(row), qOf(row), col / p.arcSeg, o)

  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]

  for (let row = 0; row < rows; row++) {
    const n = petalOf(row)
    const q = qOf(row)
    // Normal de referencia para el vértice colapsado de la base (q = 0):
    // la espina del pétalo. Evita la normal (0,1,0) que se leería como un
    // error en el vértice más visible de la flor.
    const s0 = roseSpine(p, n, 0)
    const f0 = roseFrame(s0)
    for (let col = 0; col < cols; col++) {
      const vi = row * cols + col
      at(row, col, tmp)
      position[vi * 3] = tmp[0]
      position[vi * 3 + 1] = tmp[1]
      position[vi * 3 + 2] = tmp[2]
      for (let k = 0; k < 3; k++) {
        if (tmp[k] < min[k]) min[k] = tmp[k]
        if (tmp[k] > max[k]) max[k] = tmp[k]
      }

      uv[vi * 2] = col / p.arcSeg
      uv[vi * 2 + 1] = q
      aProgress[vi] = roseProgress(p, n, q)
      aPetal[vi] = rosePetalIndex(p, n, q)

      // Normales por diferencias centrales; una sola diferencia en los bordes
      // de la sección y en las bases de los pétalos.
      const rPrev = Math.max(0, row - 1)
      const rNext = Math.min(rows - 1, row + 1)
      const cPrev = Math.max(0, col - 1)
      const cNext = Math.min(p.arcSeg, col + 1)

      du[0] = 0; du[1] = 0; du[2] = 0
      dv[0] = 0; dv[1] = 0; dv[2] = 0
      at(rNext, col, du)
      at(rPrev, col, dv)
      tu[0] = du[0] - dv[0]; tu[1] = du[1] - dv[1]; tu[2] = du[2] - dv[2]
      at(row, cNext, du)
      at(row, cPrev, dv)
      tv[0] = du[0] - dv[0]; tv[1] = du[1] - dv[1]; tv[2] = du[2] - dv[2]

      let nx = tu[1] * tv[2] - tu[2] * tv[1]
      let ny = tu[2] * tv[0] - tu[0] * tv[2]
      let nz = tu[0] * tv[1] - tu[1] * tv[0]
      const len = Math.hypot(nx, ny, nz)
      if (len < EPS) {
        nx = f0.ex; ny = f0.ey; nz = f0.ez
      } else {
        nx /= len; ny /= len; nz /= len
      }
      normal[vi * 3] = nx
      normal[vi * 3 + 1] = ny
      normal[vi * 3 + 2] = nz
    }
  }

  // Índices sólo dentro de cada pétalo: el salto del último qi al primero del
  // pétalo siguiente se salta deliberadamente.
  let t = 0
  for (let n = 0; n < p.petals; n++) {
    for (let qi = 0; qi < p.qSeg - 1; qi++) {
      const row = n * p.qSeg + qi
      for (let col = 0; col < p.arcSeg; col++) {
        const a = row * cols + col
        const b = a + 1
        const d = a + cols
        const e = d + 1
        index[t++] = a
        index[t++] = b
        index[t++] = e
        index[t++] = a
        index[t++] = e
        index[t++] = d
      }
    }
  }

  // ¿El winding mira hacia afuera? Suma de dot(normal de cara, centro de cara
  // − centro). Si sale negativa se invierte índice y normales.
  const bboxCenter: Vec3 = [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ]
  let outward = 0
  for (let f = 0; f < triangleCount; f += 3) {
    const i0 = index[f] * 3
    const i1 = index[f + 1] * 3
    const i2 = index[f + 2] * 3
    const ex1 = position[i1] - position[i0]
    const ey1 = position[i1 + 1] - position[i0 + 1]
    const ez1 = position[i1 + 2] - position[i0 + 2]
    const ex2 = position[i2] - position[i0]
    const ey2 = position[i2 + 1] - position[i0 + 1]
    const ez2 = position[i2 + 2] - position[i0 + 2]
    outward +=
      (ey1 * ez2 - ez1 * ey2) * ((position[i0] + position[i1] + position[i2]) / 3 - bboxCenter[0]) +
      (ez1 * ex2 - ex1 * ez2) * ((position[i0 + 1] + position[i1 + 1] + position[i2 + 1]) / 3 - bboxCenter[1]) +
      (ex1 * ey2 - ey1 * ex2) * ((position[i0 + 2] + position[i1 + 2] + position[i2 + 2]) / 3 - bboxCenter[2])
  }
  if (outward < 0) {
    for (let f = 0; f < triangleCount; f += 3) {
      const s1 = index[f + 1]
      index[f + 1] = index[f + 2]
      index[f + 2] = s1
    }
    for (let i = 0; i < vertexCount; i++) {
      normal[i * 3] = -normal[i * 3]
      normal[i * 3 + 1] = -normal[i * 3 + 1]
      normal[i * 3 + 2] = -normal[i * 3 + 2]
    }
  }

  // Normalización: escala uniforme para que el lado mayor del bbox sea 1, de
  // modo que la cámara pueda encuadrar sólo con ROSE_BOUNDS.
  const rawSize = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2])
  const scale = 1 / rawSize
  const pivot: Vec3 = [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ]
  if (!opts.skipNormalize) {
    for (let i = 0; i < vertexCount; i++) {
      position[i * 3] = (position[i * 3] - pivot[0]) * scale
      position[i * 3 + 1] = (position[i * 3 + 1] - pivot[1]) * scale
      position[i * 3 + 2] = (position[i * 3 + 2] - pivot[2]) * scale
    }
    for (let k = 0; k < 3; k++) {
      min[k] = (min[k] - pivot[k]) * scale
      max[k] = (max[k] - pivot[k]) * scale
    }
  }

  // El "corazón" de la flor: el eje del capullo de pétalos interiores, que es
  // donde nace el brillo central y desde donde crece la geometría.
  let cx = 0
  let cz = 0
  for (let i = 0; i < vertexCount; i++) {
    cx += position[i * 3]
    cz += position[i * 3 + 2]
  }
  cx /= vertexCount
  cz /= vertexCount

  const center: Vec3 = [cx, (min[1] + max[1]) / 2, cz]
  const radius = Math.max(
    Math.hypot(max[0] - center[0], max[1] - center[1], max[2] - center[2]),
    Math.hypot(min[0] - center[0], min[1] - center[1], min[2] - center[2]),
  )
  const core: Vec3 = [center[0], center[1], center[2]]

  return {
    position,
    normal,
    uv,
    aProgress,
    aPetal,
    index,
    vertexCount,
    triangleCount,
    bounds: {
      min,
      max,
      center,
      radius,
      aspect: Math.max(max[0] - min[0], max[2] - min[2]) / Math.max(max[1] - min[1], 1e-6),
    },
    rows,
    cols,
    core,
  }
}
