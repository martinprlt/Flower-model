import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils, PerspectiveCamera, Vector3 } from 'three'

import { CAMERA } from '../../config'
import { frameRose, type Framing } from '../../math/geometry'
import type { RoseBounds } from '../../math/rose'
import { pushInAmount, type Phase, type Schedule } from '../../state'

const UP = new Vector3(0, 1, 0)
const tmp = new Vector3()

/** Estructural: evita depender del export `Controls`, que cambia de versión. */
interface OrbitControlsLike {
  target: Vector3
  minDistance: number
  maxDistance: number
  update(): void
  addEventListener(type: string, listener: () => void): void
  removeEventListener(type: string, listener: () => void): void
}

export interface CameraRigProps {
  bounds: RoseBounds
  /** Cambia sólo cinco veces en toda la experiencia: no hace falta leerla en el frame. */
  phase: Phase
  schedule: Schedule
  reduced: boolean
  /** Se dispara la primera vez que el usuario toca la escena. */
  onFirstInteraction: () => void
}

/**
 * Encuadre, rotación automática y acercamiento final.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  POR QUÉ NO SE USA controls.autoRotate
 * ─────────────────────────────────────────────────────────────────────────
 * Leído en el código fuente de three y de drei: OrbitControls.update() sin
 * argumento aplica un ángulo FIJO por frame, de modo que autoRotate es
 * dependiente del framerate — a 120 fps gira el doble que a 60 y la vuelta a
 * los 78 s no existiría. Peor: _rotateLeft escribe en _sphericalDelta, que es
 * el MISMO buffer de inercia que alimenta el arrastre. Al soltar la
 * inercia sigue corriendo, y reanudar el autoRotate encima produce un
 * visible salto.
 *
 * Aquí se rota la cámara a mano y la velocidad pasa por MathUtils.damp, que
 * es continua: arrancar y parar son C0 por construcción, es decir, por
 * diseño, no por suerte.
 * ─────────────────────────────────────────────────────────────────────────
 */
export function CameraRig({
  bounds,
  phase,
  schedule,
  reduced,
  onFirstInteraction,
}: CameraRigProps) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const size = useThree((s) => s.size)
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsLike | null

  const framing = useRef<Framing | null>(null)
  // El objetivo como Vector3: distanceTo/copy/sub no aceptan un trío suelto,
  // y tenlo aparte evita asignar un Vector3 nuevo en cada frame.
  const targetV = useRef(new Vector3())
  const omega = useRef(0)
  const lastInteraction = useRef(-1e9)
  const pushBase = useRef(0)
  const touched = useRef(false)

  // ── Encuadre, a partir exclusivamente del bounding box ───────────────────
  // No hay una sola coordenada de cámara escrita a mano: si mañana cambia la
  // ecuación, esto se recuadra solo.
  useEffect(() => {
    const aspect = Math.max(size.width / Math.max(size.height, 1), 1e-3)
    const f = frameRose(bounds, CAMERA.fov, aspect, CAMERA.headroom)
    framing.current = f

    camera.fov = CAMERA.fov
    camera.near = 0.01
    camera.far = Math.max(f.distance * 20, 40)
    camera.updateProjectionMatrix()

    if (!controls) return
    // Composición armónica: en vertical (móvil) y horizontal (escritorio),
    // desplazamos suavemente el objetivo hacia abajo para que la flor viva en la
    // zona superior y NUNCA se superponga con la dedicatoria en la zona inferior.
    const isPortrait = aspect < 1
    const yShift = isPortrait ? -bounds.radius * 0.24 : -bounds.radius * 0.10
    const targetY = f.target[1] + yShift

    controls.target.set(f.target[0], targetY, f.target[2])
    targetV.current.set(f.target[0], targetY, f.target[2])
    controls.minDistance = f.distance * CAMERA.minDistanceScale
    controls.maxDistance = f.distance * CAMERA.maxDistanceScale

    if (!touched.current) {
      camera.position.set(f.position[0], f.position[1] + yShift, f.position[2])
      camera.lookAt(f.target[0], targetY, f.target[2])
    }
    controls.update()

    ;(window as unknown as Record<string, unknown>).__ROSE_CAMERA__ = {
      setAngles: (azDeg: number, elDeg: number) => {
        touched.current = true
        omega.current = 0
        // Un encuadre pedido a mano cuenta como interacción: si no, el giro
        // automático podía arrancar entre el setAngles y la captura y mover la
        // cámara unos grados, arruinando la comparación píxel a píxel.
        lastInteraction.current = performance.now()
        const az = (azDeg * Math.PI) / 180
        const el = (elDeg * Math.PI) / 180
        const d = f.distance
        camera.position.set(
          f.target[0] + d * Math.cos(el) * Math.sin(az),
          targetY + d * Math.sin(el),
          f.target[2] + d * Math.cos(el) * Math.cos(az)
        )
        camera.lookAt(f.target[0], targetY, f.target[2])
        controls.target.set(f.target[0], targetY, f.target[2])
        controls.update()
      },
    }
  }, [bounds, camera, controls, size.width, size.height])

  // ── 'start' y 'end' son eventos de entrada del usuario, no de cambio ────
  // No se escucha 'change': nuestro propio giro dispara 'change' y detendría
  // la rotación en el primer frame.
  useEffect(() => {
    if (!controls) return
    const mark = () => {
      lastInteraction.current = performance.now()
      omega.current = 0
      if (!touched.current) {
        touched.current = true
        onFirstInteraction()
      }
    }
    controls.addEventListener('start', mark)
    controls.addEventListener('end', mark)
    return () => {
      controls.removeEventListener('start', mark)
      controls.removeEventListener('end', mark)
    }
  }, [controls, onFirstInteraction])

  // La rotación espera a que el florecimiento termine para no competir con el
  // acercamiento.
  useEffect(() => {
    if (phase === 'INTERACTIVE') {
      lastInteraction.current = performance.now()
      omega.current = 0
    }
  }, [phase])

  useFrame((_, dt) => {
    if (!controls) return

    // Acercamiento final: se desplaza la cámara a lo largo de su propia
    // dirección, así el ángulo no cambia y sólo se acerca. Con
    // prefers-reduced-motion no se mueve la cámara en absoluto — no basta con
    // poner la duración a 0, eso la ejecutaría igual y de golpe.
    if (phase === 'BLOOMED' && framing.current && !reduced) {
      const d = camera.position.distanceTo(targetV.current)
      if (d > 1e-4) {
        if (pushBase.current === 0) pushBase.current = d
        const goal = pushBase.current * (1 - CAMERA.introPushIn * pushInAmount(schedule))
        tmp.copy(camera.position).sub(targetV.current).setLength(goal).add(targetV.current)
        camera.position.copy(tmp)
        controls.update()
      }
    } else {
      pushBase.current = 0
    }

    const now = performance.now()
    const wantSpin =
      phase === 'INTERACTIVE' &&
      !reduced &&
      now - lastInteraction.current > CAMERA.autoRotateResumeDelayMs
    const targetOmega = wantSpin ? (2 * Math.PI) / CAMERA.secondsPerRevolution : 0

    omega.current = MathUtils.damp(omega.current, targetOmega, CAMERA.autoRotateRamp, dt)

    const step = omega.current * dt
    if (step > 1e-6) {
      camera.position.sub(targetV.current).applyAxisAngle(UP, step).add(targetV.current)
      controls.update()
    }
  })

  return null
}