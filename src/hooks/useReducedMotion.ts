import { useState } from 'react'

/**
 * prefers-reduced-motion.
 *
 * Se llama en el primer render, no en un effect: si no, la intro arrancaría
 * con la duración normal y un frame después se cambiaría, y el usuario notaría
 * el salto.
 */
export function useReducedMotion(): boolean {
  const [reduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
      return false
    }
  })
  return reduced
}