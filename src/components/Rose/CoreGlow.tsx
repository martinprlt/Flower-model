import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, CanvasTexture, Sprite, SpriteMaterial } from 'three'

import { PALETTE } from '../../config'
import { getRose } from '../../math/geometry'
import type { Tier } from '../../math/rose'
import { coreLead, roseGrow, type Schedule } from '../../state'

/**
 * El pequeño resplandor central.
 *
 * Es una mancha radial dibujada en un canvas, no un sistema de partículas. Se
 * pinta una vez y sólo cuesta un sprite, sin depender de la pasada de
 * postprocesado ni de que el bloom esté activo.
 *
 * Existe porque si no, "la rosa en reposo" no se ve: con uProgress = 0 todos
 * sus vértices caen sobre el mismo punto y todos sus triángulos tienen área
 * cero, es decir, no hay ni un píxel en el que el shader pudiera emitir. Este
 * punto no es la rosa: es una cosa aparte que se enciende al final de la
 * intro y se apaga justo cuando empieza a crecer.
 */
export function CoreGlow({ tier, schedule }: { tier: Tier; schedule: Schedule }) {
  const rose = useMemo(() => getRose(tier), [tier])

  const texture = useMemo(() => {
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (ctx) {
      // Dos paradas duras y una blanda: núcleo nítido, halo que se apaga sin
      // dejar visible el borde del cuadrado.
      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
      g.addColorStop(0, 'rgba(255, 230, 230, 1)')
      g.addColorStop(0.18, `${PALETTE.glow}cc`)
      g.addColorStop(0.5, `${PALETTE.lit}55`)
      g.addColorStop(1, `${PALETTE.core}00`)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, size, size)
    }
    const tex = new CanvasTexture(canvas)
    tex.colorSpace = 'srgb'
    return tex
  }, [])

  const material = useMemo(
    () =>
      new SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        // Aditivo: sobre un fondo casi negro se lee como luz y no como una
        // mancha pegada encima de la escena.
        blending: AdditiveBlending,
        opacity: 0,
      }),
    [texture],
  )

  const sprite = useMemo(() => {
    const s = new Sprite(material)
    s.position.set(rose.core[0], rose.core[1], rose.core[2])
    s.scale.setScalar(0.16)
    s.renderOrder = 10
    return s
  }, [material, rose])

  useEffect(
    () => () => {
      texture.dispose()
      material.dispose()
    },
    [texture, material],
  )

  useFrame(() => {
    // Se enciende durante el silencio final de la intro y se va con el
    // crecimiento, para que no quede un resplandor huérfano sobre la rosa
    // ya formada.
    const lead = coreLead(schedule)
    const grown = roseGrow(schedule)
    sprite.material.opacity = 0.95 * lead * (1 - Math.min(1, grown * 6))
    sprite.visible = sprite.material.opacity > 0.004
    // Latebre: pulsa muy suavemente mientras espera.
    const p = 1 + 0.06 * Math.sin(performance.now() / 420)
    sprite.scale.setScalar(0.16 * p)
  })

  return <primitive object={sprite} />
}