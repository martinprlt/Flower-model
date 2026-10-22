/**
 * state.ts — La máquina de estados de la experiencia.
 *
 * LOADING → INTRO → GROWING → BLOOMED → INTERACTIVE
 *
 * Un único reloj (requestAnimationFrame en App.tsx) compara el tiempo
 * transcurrido con la tabla de duraciones de config.ts. Ningún componente
 * programa tiempos con setTimeout: si algo se desincroniza, se desincroniza
 * en un solo sitio.
 */

import { REDUCED, TIMING } from './config'

export type Phase = 'LOADING' | 'INTRO' | 'GROWING' | 'BLOOMED' | 'INTERACTIVE'

export type MathMode = 'rosa' | 'matematica'

/** Las tres etapas de la disolución superficie → estructura. */
export const DISSOLVE = { SOLID: 0, TRANS: 1, STRUCT: 2 } as const
export type Dissolve = (typeof DISSOLVE)[keyof typeof DISSOLVE]

export interface Schedule {
  introDark: number
  introHold: number
  introGap: number
  glowLead: number
  grow: number
  bloomHold: number
  pushIn: number
  messageFade: number
  hintLife: number
}

export function makeSchedule(reduced: boolean): Schedule {
  return reduced ? { ...REDUCED } : { ...TIMING }
}

/** Fase siguiente. INTERACTIVE es terminal. */
export const NEXT: Record<Phase, Phase | null> = {
  LOADING: 'INTRO',
  INTRO: 'GROWING',
  GROWING: 'BLOOMED',
  BLOOMED: 'INTERACTIVE',
  INTERACTIVE: null,
}

/**
 * Progreso de la floración dentro de GROWING, 0 → 1, con easing.
 *
 * No es un ease lineal: la rosa tiene que arrancar con decisión (los primeros
 * pétalos se abren rápido, que es lo que se ve) y después asentarse. Se usa un
 * smoothstep clásico; su derivada es continua, así que no hay tirón al empezar
 * ni al terminar.
 */
export function growProgress(t: number): number {
  const c = Math.min(1, Math.max(0, t))
  return c * c * (3 - 2 * c)
}

/** Cuánto lleva la escena en la fase actual, en ms. */
export function phaseElapsed(now: number, enteredAt: number): number {
  return now - enteredAt
}

/** Progreso 0→1 dentro de una fase, acotado por su duración. */
export function phaseProgress(now: number, enteredAt: number, duration: number): number {
  if (duration <= 0) return 1
  return Math.min(1, Math.max(0, phaseElapsed(now, enteredAt) / duration))
}

/**
 * Línea de tiempo compartida, mutable.
 *
 * Los valores que cambian a 60 fps (grow, pushIn, el brillo del frente) no
 * pueden pasar por `setState`: React volvería a montar la escena 370 veces
 * durante el florecimiento. Se escriben aquí desde un único rAF y se leen
 * dentro de `useFrame`. El estado de React sólo cambia en los cinco cambios
 * de fase.
 */
export interface Timeline {
  /** performance.now() en milisegundos. */
  now: number
  phase: Phase
  enteredAt: number
}

export const timeline: Timeline = {
  now: 0,
  phase: 'LOADING',
  enteredAt: 0,
}

/**
 * Cuánto ha florecido la rosa, 0 → 1, ya suavizado.
 *
 * LOADING e INTRO devuelven 0: con `uProgress = 0` todos los vértices se
 * colapsan sobre el punto de origen y la rosa no ocupa ni un píxel. Es lo que
 * impide que aparezca un frame antes de que empiece la secuencia.
 */
export function roseGrow(s: Schedule): number {
  const t = timeline.now - timeline.enteredAt
  if (timeline.phase === 'LOADING' || timeline.phase === 'INTRO') return 0
  if (timeline.phase === 'GROWING') return growProgress(t / s.grow)
  return 1
}

/**
 * El punto central antes de que exista la rosa, 0 → 1.
 * Sólo existe al final de INTRO, después del silencio.
 */
export function coreLead(s: Schedule): number {
  if (timeline.phase !== 'INTRO') return 0
  const t = timeline.now - timeline.enteredAt
  const start = s.introDark + s.introHold + s.introGap
  const local = t - start
  if (local <= 0) return 0
  const u = Math.min(1, local / Math.max(s.glowLead, 1))
  // easeOut: aparece de golpe y se asienta, que es como se enciende un punto.
  return 1 - (1 - u) * (1 - u)
}

/** Resplandor del frente de crecimiento, ya escalado al pico. */
export function frontGlow(s: Schedule, peak: number): number {
  if (timeline.phase === 'INTRO') return peak * 0.9 * coreLead(s)
  if (timeline.phase !== 'GROWING') return 0
  const g = roseGrow(s)
  // Continuo con el pico del final de INTRO (0.9 · peak en g = 0) y con el 0
  // del final del crecimiento, sin un escalón en ninguno de los dos lados.
  return peak * Math.min(1, 0.9 * (1 - g) + Math.sin(Math.PI * g))
}

/**
 * Cuánta estructura matemática se ve, 0 → 1.
 *
 * Durante el florecimiento la flor empieza siendo puntos y aristas y a partir
 * del 55 % de progreso va cediendo sitio a la superficie — esa es la frase
 * "la representación matemática gradualmente adquiere superficie". Después,
 * sólo si el usuario la pide.
 */
export function mathReveal(s: Schedule, mode: MathMode): number {
  if (timeline.phase === 'LOADING') return 0
  if (timeline.phase === 'INTRO') return 1
  if (timeline.phase === 'GROWING') {
    const g = roseGrow(s)
    const u = Math.min(1, Math.max(0, (g - 0.55) / 0.4))
    return 1 - u * u * (3 - 2 * u)
  }
  if (timeline.phase === 'BLOOMED') return 0
  return mode === 'matematica' ? 1 : 0
}

/** Acercamiento durante BLOOMED, 0 → 1. */
export function pushInAmount(s: Schedule): number {
  if (timeline.phase !== 'BLOOMED') return 0
  if (s.pushIn <= 0) return 1
  const hold = Math.min(1, (timeline.now - timeline.enteredAt) / s.bloomHold)
  if (hold < 1) return 0
  const u = Math.min(1, (timeline.now - timeline.enteredAt - s.bloomHold) / s.pushIn)
  return u * u * (3 - 2 * u)
}