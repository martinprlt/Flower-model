import { useEffect, useState } from 'react'

import type { Quality } from '../../hooks/useQuality'
import { getRose } from '../../math/geometry'
import type { RoseParams } from '../../math/rose'

interface Snapshot {
  phase?: string
  phaseMs?: number
  grow?: number
  mathReveal?: number
  mode?: string
  reduced?: boolean
  tier?: string
  dpr?: number
  shadows?: boolean
  bloom?: boolean
  fps?: number
}

/**
 * El panel de texto de depuración.
 *
 * Vive FUERA del Canvas, como DOM normal. Dentro sólo pueden ir objetos de
 * three, y un `<pre>` ahí dentro tira la escena entera (ver DebugHelpers).
 *
 * Lee `window.__ROSE_DEBUG__`, que App escribe una vez por frame en modo
 * debug, y lo refresca a 4 Hz: a 60 Hz el texto sería ilegible y el coste de
 * re-render no tendría ningún sentido. El FPS lo mide ese mismo rAF de App,
 * así que aquí no hay ningún bucle propio.
 */
export function DebugReadout({ quality }: { quality: Quality }) {
  const [snap, setSnap] = useState<Snapshot>({})

  useEffect(() => {
    const read = () => {
      const d = (window as unknown as { __ROSE_DEBUG__?: Snapshot }).__ROSE_DEBUG__
      if (d) setSnap({ ...d })
    }
    read()
    const id = window.setInterval(read, 250)
    return () => window.clearInterval(id)
  }, [])

  const rose = getRose(quality.tier)
  const p = rose.params as RoseParams
  const phiRim = (Math.PI / 2) * Math.exp(-p.thetaMap / (8 * Math.PI))
  const f3 = (v: number) => v.toFixed(3)

  const lines = [
    `fase       ${snap.phase ?? '?'}   ${snap.grow !== undefined ? `grow ${f3(snap.grow)}` : ''}`,
    `fase ms    ${snap.phaseMs ?? '?'}`,
    `estructura ${snap.mathReveal !== undefined ? f3(snap.mathReveal) : '?'}   modo ${snap.mode ?? '?'}`,
    `reduced    ${snap.reduced ?? '?'}`,
    `fps        ${snap.fps ?? '?'}`,
    `tier       ${snap.tier ?? quality.tier}`,
    `dpr        ${snap.dpr ?? quality.dpr}`,
    `sombras    ${snap.shadows ? `sí · ${quality.mapSize}²` : 'no'}`,
    `bloom      ${snap.bloom ? 'sí' : 'no'}`,
    `vértices   ${rose.vertexCount}`,
    `triángulos ${rose.triangleCount}`,
    `pétalos    ${p.petals}  (qSeg ${p.qSeg}, arcSeg ${p.arcSeg})`,
    `radio      ${f3(rose.bounds.radius)}   aspecto ${f3(rose.bounds.aspect)}`,
    `φ(borde)   ${((phiRim * 180) / Math.PI).toFixed(1)}°`,
  ]

  return <pre className="debug-panel">{lines.join('\n')}</pre>
}