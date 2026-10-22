import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, Vector3 } from 'three'

import { PALETTE } from '../../config'
import { getRose } from '../../math/geometry'
import type { Tier } from '../../math/rose'
import { createStructureMaterials } from '../../shaders/growth'
import { frontGlow, mathReveal, roseGrow, type MathMode, type Schedule } from '../../state'

export interface MathModelProps {
  tier: Tier
  schedule: Schedule
  mode: MathMode
}

/**
 * La representación matemática: aristas y puntos rojos, sin superficie ni
 * iluminación.
 *
 * Usa el MISMO aProgress y el MISMO crecimiento que la rosa, así que ambas
 * nacen a la vez y en sincronía. Ese es el punto: no hay un objeto que se
 * cambia por otro, hay una flor que pierde las capas que la hacían ser una
 * flor y queda siendo puro cálculo.
 *
 * Los puntos llevan el mismo frente de crecimiento que la superficie, con el
 * mismo resplandor, para que el nacimiento se vea igual en los dos modos.
 */
export function MathModel({ tier, schedule, mode }: MathModelProps) {
  const rose = useMemo(() => getRose(tier), [tier])
  const core = useMemo(() => new Vector3(...rose.core), [rose])

  const struct = useMemo(
    () =>
      createStructureMaterials(
        PALETTE.wire,
        PALETTE.point,
        PALETTE.glow,
        core,
        0.016,
        typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1,
      ),
    [core],
  )

  useEffect(() => () => struct.dispose(), [struct])

  const revealRef = useRef(0)
  const wireRef = useRef<import('three').Mesh>(null)
  const pointsRef = useRef<import('three').Points>(null)

  useFrame((_, dt) => {
    const u = struct.uniforms

    // Mismo crecimiento que la rosa, exactamente igual, y el mismo frente:
    // (grow · (1 + uWidth)) para que el último anillo llegue a estar
    // completo. Si no fuera idéntico, la transición entre los dos modos se
    // notaría como un salto en vez de como un desvanecimiento.
    const grow = roseGrow(schedule)
    u.uProgress.value = grow * (1 + u.uWidth.value)
    u.uGlowStrength.value = frontGlow(schedule, 0.35)

    // Cuánta estructura se ve. Durante el florecimiento empieza en 1 y se
    // desvanece a partir del 55 %, cediéndole sitio a la superficie; después,
    // sólo si el usuario lo pide. Se amortigua para que el cambio de modo no
    // aparezca ni desaparezca de golpe.
    const target = mathReveal(schedule, mode)
    revealRef.current = MathUtils.damp(revealRef.current, target, 3.2, Math.min(dt, 0.1))
    const reveal = revealRef.current

    u.uOpacity.value = reveal
    const visible = reveal > 0.01
    if (wireRef.current) wireRef.current.visible = visible
    if (pointsRef.current) pointsRef.current.visible = visible
    struct.wireframe.opacity = reveal * 0.9
  })

  return (
    <group>
      <mesh
        ref={wireRef}
        geometry={rose.geometry}
        material={struct.wireframe}
        renderOrder={3}
        visible={false}
        frustumCulled={false}
      />
      <points
        ref={pointsRef}
        geometry={rose.geometry}
        material={struct.points}
        renderOrder={4}
        visible={false}
        frustumCulled={false}
      />
    </group>
  )
}