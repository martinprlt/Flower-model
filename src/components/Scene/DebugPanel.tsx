import { useMemo } from 'react'
import { AxesHelper, Box3, Box3Helper, Color, Vector3 } from 'three'

import { getRose } from '../../math/geometry'
import type { Tier } from '../../math/rose'

/**
 * Ayudas 3D de depuración. SÓLO objetos de three: dentro del Canvas de R3F no
 * puede haber elementos del DOM.
 *
 * Aprendido a golpes: tener aquí un `<pre>` para volcar los datos hacía que
 * R3F intentara montarlo como objeto de la escena (no existe `THREE.Pre`) y
 * se cayera el Canvas entero. El panel de texto vive fuera, en DebugReadout.
 */
export function DebugHelpers({ tier }: { tier: Tier }) {
  const rose = useMemo(() => getRose(tier), [tier])

  const box = useMemo(() => {
    const b = rose.bounds
    return new Box3Helper(
      new Box3(
        new Vector3(b.min[0], b.min[1], b.min[2]),
        new Vector3(b.max[0], b.max[1], b.max[2]),
      ),
      new Color(0x5cc8ff),
    )
  }, [rose])

  const axes = useMemo(() => {
    const a = new AxesHelper(rose.bounds.radius * 1.4)
    a.position.set(rose.bounds.center[0], rose.bounds.min[1], rose.bounds.center[2])
    return a
  }, [rose])

  return (
    <>
      <primitive object={axes} />
      <primitive object={box} />
    </>
  )
}