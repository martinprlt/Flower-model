/**
 * config.ts — Única fuente de verdad de la experiencia.
 *
 * Aquí se cambia todo lo que es texto, color, tiempo o cámara. Ningún
 * componente debe hardcodear nada de esto.
 */

export const GIFT = {
  /** Destinataria. Aparece en la dedicatoria final. */
  recipient: 'Bárbara',
  /** Remitente. Aparece en la firma. */
  sender: 'Emi',
  /** Corazón de la dedicatoria. */
  heart: '♡',
} as const

export const COPY = {
  /** Frase de apertura, antes de que la rosa exista. */
  introLead: 'Las flores se marchitan…',
  /** Segunda línea de la apertura, más tenue. Opcional. */
  introFaint: '',
  /** Mensaje principal al terminar el florecimiento. */
  message: 'Las flores se marchitan,\nasí que te hice una\nque no puede hacerlo.',
  /** Dedicatoria. */
  dedication: `Para ${GIFT.recipient} ${GIFT.heart}`,
  /** Firma, mucho más pequeña. */
  signoff: `— ${GIFT.sender}`,
  /** Pista de interacción, discreta. */
  hint: 'Arrástrala · tócala',
  /** Panel matemático. */
  mathTitle: 'Esta rosa está hecha de matemáticas.',
  mathBlurb: 'Cada punto de la flor fue calculado a partir de estas ecuaciones.',
  /** Etiquetas del selector ROSA | MATEMÁTICA. */
  modeRose: 'ROSA',
  modeMath: 'MATEMÁTICA',
  /** Accesibilidad del punto de carga. */
  loading: 'Cargando',
  /** Botón de audio: siempre inactivo salvo que se configure una pista. */
  audio: 'Música',
} as const

export const PALETTE = {
  /** Centro del capullo aterciopelado: carmesí oscuro profundo. */
  core: '#3A030D',
  /** Color base aterciopelado de los pétalos. */
  petal: '#8E0F28',
  /** Zonas iluminadas aterciopeladas. */
  lit: '#BD1B3B',
  /** Bordes y destellos de terciopelo. */
  highlight: '#DC3656',
  /** Color del resplandor durante el crecimiento y del pulso al tocar. */
  glow: '#FF4D6B',
  /** Luz de contra aterciopelada. */
  rim: '#FF758C',

  /** Fondo: degradado vertical de tres paradas. Nunca negro puro. */
  bgTop: '#090205',
  bgMid: '#14060B',
  bgBottom: '#1A0810',
  /** Halo radial detrás de la rosa. Más luminoso para dar brillo desde el interior. */
  halo: '#5A1526',

  /** Estructura matemática visible. */
  wire: '#FF7A8C',
  point: '#FFB3BE',

  /** Luz key cálida, fill rojiza y ambiente. */
  lightAmbient: '#22060E',
  lightKey: '#FFF0E6',
  lightFill: '#6E0A1E',
} as const

/**
 * Tiempos de la secuencia, en milisegundos. El reloj es un único rAF en
 * App.tsx: ninguna transición se programa con setTimeout.
 */
export const TIMING = {
  /** Antes de que aparezca la primera frase. */
  introDark: 750,
  /** Cuánto se queda la frase. */
  introHold: 2050,
  /** Silencio después de la frase. */
  introGap: 400,
  /** Latido del punto central antes de que empiece a crecer la rosa. */
  glowLead: 250,
  /** Floración. */
  grow: 6200,
  /** Pausa con la rosa ya formada, antes del acercamiento. */
  bloomHold: 700,
  /** Acercamiento de cámara muy sutil. */
  pushIn: 2600,
  /** El mensaje se desvanece en... */
  messageFade: 1200,
  /** Cuánto dura la pista "arrástrala". */
  hintLife: 5200,
} as const

/**
* Con prefers-reduced-motion la experiencia se comprime al mínimo pero sigue
 * contando la misma historia: texto legible, rosa completa, sin movimientos
 * grandes.
 */
export const REDUCED = {
  introDark: 200,
  introHold: 1400,
  introGap: 150,
  glowLead: 80,
  grow: 1100,
  bloomHold: 300,
  pushIn: 0,
  messageFade: 400,
  hintLife: 3200,
  /** Segundos por vuelta de la rotación automática. */
  secondsPerRevolution: 300,
  /** Los motas de polvo no se mueven. */
  particles: 0,
} as const

export const CAMERA = {
  /** Campo de visión. Corto: menos distorsión, más cinematográfico. */
  fov: 34,
  /** Holgura de composición sobre el encuadre mínimo. 1.12 agranda la rosa
   *  ~11 % respecto de 1.24 sin recortarla en ningún ángulo orbital. */
  headroom: 1.12,
  /** Segundos por vuelta de la rotación automática (60–100 s). */
  secondsPerRevolution: 78,
  /** Espera tras la última interacción antes de reanudar el giro. */
  autoRotateResumeDelayMs: 2600,
  /** Constante de amortiguación del ramp de giro. Mayor = reanuda más lento. */
  autoRotateRamp: 1.8,
  /** Límites de distancia como fracción del encuadre calculado. */
  minDistanceScale: 0.72,
  maxDistanceScale: 1.55,
  /** Ángulo polar: nunca por debajo del borde, nunca vista cenital pura. */
  minPolarDeg: 18,
  maxPolarDeg: 86,
  /** Damping de OrbitControls. */
  dampingFactor: 0.055,
  /** Acercamiento durante BLOOMED, como fracción del radio de la rosa. */
  introPushIn: 0.055,
} as const

export const RENDER = {
  /** Límite de DPR. */
  dprMax: 2,
  dprMaxLow: 1.5,
  /** Exposición: el control más importante para que el carmesí no suba a rosa. */
  toneMappingExposure: 1.2,
  /** Intensidad del bloom. Más brillante desde el interior. */
  bloomIntensity: 0.42,
  bloomThreshold: 0.38,
  bloomSmoothing: 0.46,
  bloomRadius: 0.78,
  /** Vignette. */
  vignetteOffset: 0.28,
  vignetteDarkness: 0.72,
  /** Picos del resplandor durante el crecimiento. */
  growthGlowPeak: 0.35,
  /** Grosor de la banda de crecimiento, en unidades de aProgress. */
  growthBand: 0.13,
} as const

export const PARTICLES = {
  /** Muy pocas. No compiten con la rosa. */
  count: 24,
  sizeMin: 0.012,
  sizeMax: 0.03,
  opacity: 0.22,
  /** Caja de deriva alrededor de la rosa, en radios de rosa. */
  spread: 3.2,
  driftMin: 0.008,
  driftMax: 0.02,
  /** Tope de FPS por debajo del cual se baja la calidad. */
  lowFpsThreshold: 45,
} as const

export const AUDIO = {
  /**
   * Ruta de una pista. Con null la aplicación no carga ningún archivo de
   * audio y el botón aparece deshabilitado. Nunca se reproduce sola.
   */
  trackUrl: null as string | null,
} as const

export const DEBUG = false