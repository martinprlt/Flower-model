import { useState } from 'react'

import { RENDER } from '../config'
import type { Tier } from '../math/rose'

export interface Quality {
  tier: Tier
  shadows: boolean
  mapSize: number
  dpr: number
  particles: boolean
  bloom: boolean
}

function detectTier(): Tier {
  if (typeof window === 'undefined') return 'mid'
  const w = window.innerWidth
  const h = window.innerHeight
  const cores = navigator.hardwareConcurrency ?? 4
  const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false

  // Pantalla pequeña y táctil: es casi seguro un teléfono. Ahí el coste real
  // no son los triángulos sino la pasada de sombras, que es por eso que el
  // tier low además desactiva las sombras.
  if (coarse && Math.min(w, h) < 480) return 'low'
  if (cores <= 4 || memory <= 2) return 'low'
  if (cores >= 8 && !coarse && Math.min(w, h) >= 900) return 'high'
  return 'mid'
}

/**
 * Calidad adaptativa.
 *
 * Se decide una sola vez al arrancar. Nunca oscila durante la sesión:
 * cambiar la resolución de la malla a mitad de un florecimiento se ve como un
 * salto, y no compensa.
 */
export function useQuality(): Quality {
  const [tier] = useState<Tier>(detectTier)
  const low = tier === 'low'
  const dpr =
    typeof window !== 'undefined' ? window.devicePixelRatio || 1 : RENDER.dprMax

  return {
    tier,
    shadows: !low,
    mapSize: tier === 'high' ? 2048 : 1024,
    dpr: Math.min(dpr, low ? RENDER.dprMaxLow : RENDER.dprMax),
    particles: !low,
    bloom: !low,
  }
}