import { useEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, MathUtils, Vector3 } from 'three'

import { PALETTE, PARTICLES, RENDER } from '../../config'
import { getRose } from '../../math/geometry'
import type { Tier } from '../../math/rose'
import { createRoseMaterials } from '../../shaders/growth'
import { frontGlow, roseGrow, type MathMode, type Phase, type Schedule } from '../../state'

export interface RoseHit {
  point: Vector3
  time: number
}

export interface MathematicalRoseProps {
  tier: Tier
  phase: Phase
  schedule: Schedule
  /** ROSA o MATEMÁTICA. La disolución se interpola a partir de aquí. */
  mode: MathMode
  reduced: boolean
  /** Se dispara con un toque limpio, no con un arrastre. */
  onTap: () => void
}

/**
 * La superficie de la rosa.
 *
 * Solo la superficie: la estructura matematica (wireframe y puntos) vive en
 * MathModel, que comparte la MISMA BufferGeometry. Repartirlas asi evita
 * dibujar el wireframe dos veces cuando el usuario cambia de modo.
 *
 * uProgress queda clavado al valor del crecimiento: al cambiar de modo la
 * rosa no vuelve a construirse.
 */
export function MathematicalRose({
  tier,
  phase,
  schedule,
  mode,
  reduced,
  onTap,
}: MathematicalRoseProps) {
  const rose = useMemo(() => getRose(tier), [tier])
  const core = useMemo(() => new Vector3(...rose.core), [rose])

  const mats = useMemo(
    () =>
      createRoseMaterials({
        color: PALETTE.petal,
        core: PALETTE.core,
        rim: PALETTE.rim,
        glow: PALETTE.glow,
        roughness: 0.78,
        // Acabado carmesí aterciopelado: CERO laca plástica (clearcoat = 0),
        // alta micro-rugosidad difusa y BRDF sheen de terciopelo completo.
        clearcoat: 0.0,
        clearcoatRoughness: 1.0,
        sheen: 1.0,
        sheenRoughness: 0.48,
        emissiveIntensity: 0.06,
        base: core,
        band: RENDER.growthBand,
        transparent: true,
      }),
    [core],
  )

  useEffect(() => {
    mats.uniforms.uHitGain.value = 0.5
    return () => mats.dispose()
  }, [mats])

  // ── Toque limpio ≠ arrastre ────────────────────────────────────────────────
  // Un pulso luminoso que se dispara al empezar a girar la rosa resultaría
  // ruidoso, así que se compara el recorrido del puntero antes de dispararlo.
  const down = useRef<{ x: number; y: number } | null>(null)
  const handleDown = (e: ThreeEvent<PointerEvent>) => {
    down.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY }
  }
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    const start = down.current
    down.current = null
    if (!start) return
    const dx = e.nativeEvent.clientX - start.x
    const dy = e.nativeEvent.clientY - start.y
    if (dx * dx + dy * dy > 36) return
    if (phase !== 'INTERACTIVE') return
    // Se guarda el punto; la uniform se escribe en el siguiente frame desde
    // useFrame, que es donde se tiene el reloj de la escena. Si aquí se
    // calculara con performance.now() el anillo nunca coincidiría con uTime.
    pendingHit.current = e.point.clone()
    onTap()
  }

  const pendingHit = useRef<Vector3 | null>(null)
  const dissolveRef = useRef(0)

  useFrame((state, dt) => {
    const u = mats.uniforms

    if (pendingHit.current) {
      u.uHitPoint.value.copy(pendingHit.current)
      u.uHitTime.value = state.clock.elapsedTime
      pendingHit.current = null
    }

    // Crecimiento y brillo del frente se leen de la línea de tiempo, no de
    // props: van a 60 fps y pasarlos por setState remontaría la escena
    // cientos de veces durante el florecimiento. Un único rAF los escribe.
    const grow = roseGrow(schedule)
    u.uProgress.value = grow * (1 + u.uWidth.value)
    u.uGlowStrength.value = frontGlow(
      schedule,
      RENDER.growthGlowPeak * (reduced ? 0.35 : 1),
    )
    // Los tiempos del shader y el de la línea de tiempo son el mismo reloj.
    u.uTime.value = state.clock.elapsedTime

    // La disolución no es un valor que llegue por prop: se amortigua aquí
    // dentro hacia el modo pedido. Así la transición es continua y no se
    // reinicia el estado de React cada vez que el usuario pulsa.
    const targetDissolve = mode === 'matematica' ? 2 : 0
    // Se acota el dt para que una pestaña en segundo plano no haga que la
    // disolución salte de golpe al volver.
    dissolveRef.current = MathUtils.damp(dissolveRef.current, targetDissolve, 3.2, Math.min(dt, 0.1))
    const d = Math.min(2, Math.max(0, dissolveRef.current))
    // La superficie es lo unico que controla aqui; toda la estructura
    // (wireframe y puntos) pertenece a MathModel, que tiene su propio
    // reveal. Tenerla tambien aqui dibujaria el wireframe DOS veces.
    mats.surface.opacity = 1 - 0.5 * d
    mats.surface.transparent = true
    mats.surface.depthWrite = 1 - 0.5 * d > 0.55
  })

  return (
    <group>
      <mesh
        geometry={rose.geometry}
        material={mats.surface}
        customDepthMaterial={mats.depth}
        castShadow
        receiveShadow
        onPointerDown={handleDown}
        onClick={handleClick}
      />
    </group>
  )
}

/**
 * Un puñado de motas. Lentas, diminutas y casi transparentes: están para que
 * el aire no parezca un vacío, no para que se vean. Ni corazones, ni glitter,
 * ni galaxia.
 *
 * Deterministas: LCG sembrado en lugar de Math.random(), para que la escena
 * sea idéntica en cada carga.
 */
export function RoseParticles({ enabled }: { enabled: boolean }) {
  const count = enabled ? PARTICLES.count : 0

  const { geometry, seeds, drift } = useMemo(() => {
    let seed = 0x2f6e2b1
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 0xffffffff
    }
    const pos = new Float32Array(count * 3)
    const sd = new Float32Array(count * 3)
    const dr = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const r = 1.1 + rand() * (PARTICLES.spread - 1.1)
      const th = rand() * Math.PI * 2
      const ph = Math.acos(2 * rand() - 1)
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th)
      pos[i * 3 + 1] = r * Math.cos(ph) * 0.55 + 0.1
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th)
      sd[i * 3] = rand() * Math.PI * 2
      sd[i * 3 + 1] = rand() * Math.PI * 2
      sd[i * 3 + 2] = PARTICLES.sizeMin + rand() * (PARTICLES.sizeMax - PARTICLES.sizeMin)
      dr[i] = PARTICLES.driftMin + rand() * (PARTICLES.driftMax - PARTICLES.driftMin)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(pos, 3))
    return { geometry: g, seeds: sd, drift: dr }
  }, [count])

  const attrRef = useRef<BufferAttribute>(null)

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame((state, dt) => {
    if (!enabled || count === 0) return
    const attr = geometry.getAttribute('position') as BufferAttribute
    attrRef.current = attr
    const arr = attr.array as Float32Array
    const t = state.clock.elapsedTime
    const lim = PARTICLES.spread
    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      arr[i3] += drift[i] * dt * 0.4
      arr[i3 + 1] += Math.sin(t * 0.21 + seeds[i3]) * drift[i] * dt
      arr[i3 + 2] += Math.cos(t * 0.17 + seeds[i3 + 1]) * drift[i] * dt
      if (arr[i3] > lim) arr[i3] = -lim
      else if (arr[i3] < -lim) arr[i3] = lim
      if (arr[i3 + 2] > lim) arr[i3 + 2] = -lim
      else if (arr[i3 + 2] < -lim) arr[i3 + 2] = lim
    }
    attr.needsUpdate = true
  })

  if (count === 0) return null

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        color={PALETTE.highlight}
        size={PARTICLES.sizeMax * 1.8}
        sizeAttenuation
        transparent
        opacity={PARTICLES.opacity}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  )
}

/** Color del resplandor, expuesto para el halo de fondo. */
export const GLOW_COLOR = new Color(PALETTE.glow)
