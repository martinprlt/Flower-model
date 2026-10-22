import { Suspense, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { ACESFilmicToneMapping, PCFSoftShadowMap } from 'three'

import { CAMERA, RENDER } from '../config'
import type { Quality } from '../hooks/useQuality'
import { getRose } from '../math/geometry'
import type { RoseBounds, Tier } from '../math/rose'
import type { MathMode, Phase, Schedule } from '../state'
import { CoreGlow } from './Rose/CoreGlow'
import { MathModel } from './Rose/MathModel'
import { MathematicalRose, RoseParticles } from './Rose/MathematicalRose'
import { Background } from './Scene/Background'
import { CameraRig } from './Scene/CameraRig'
import { Effects } from './Scene/Effects'
import { Lighting } from './Scene/Lighting'

/** Hacia donde apunta el halo del fondo: detrás y ligeramente arriba. */
const HALO_DIR: [number, number, number] = [0.3, 0.34, 0.89]

const boundsCache = new Map<Tier, RoseBounds>()
function boundsFor(tier: Tier): RoseBounds {
  let b = boundsCache.get(tier)
  if (!b) {
    b = getRose(tier).bounds
    boundsCache.set(tier, b)
  }
  return b
}

export interface ExperienceProps {
  quality: Quality
  schedule: Schedule
  /** Cambia cinco veces: no hace falta leerlo en el frame. */
  phase: Phase
  mode: MathMode
  reduced: boolean
  onFirstInteraction: () => void
  onTap: () => void
  /** Sólo ?debug=true. No hay nada que montar en producción. */
  overlay?: ReactNode
}

/**
 * La escena completa.
 *
 * El Canvas sólo se monta cuando la geometría ya existe (App la construye
 * detrás del punto de carga, antes de la intro). Eso es lo que evita tres
 * fallos a la vez: que la rosa aparezca un frame antes de la intro, que haya
 * flash blanco y que haya salto de layout.
 *
 * No recibe `grow` ni `dissolve`: son valores a 60 fps y por propiedades
 * React volvería a montar la escena cientos de veces. Se leen dentro de
 * `useFrame` desde la línea de tiempo compartida.
 */
export function Experience({
  quality,
  schedule,
  phase,
  mode,
  reduced,
  onFirstInteraction,
  onTap,
  overlay,
}: ExperienceProps) {
  return (
    <div className="scene">
      <Canvas
      dpr={[1, quality.dpr]}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        toneMapping: ACESFilmicToneMapping,
        // Exposición: el control que sube el carmesí #8F1028 a un rojo
        // legible sin llegar a rosa bajo las tres luces. Sólo existe aquí.
        toneMappingExposure: RENDER.toneMappingExposure,
      }}
      shadows={quality.shadows ? { type: PCFSoftShadowMap } : false}
      camera={{ fov: CAMERA.fov, near: 0.01, far: 140, position: [1, 1, 3] }}
      // Sin desplazamiento accidental de la página durante la experiencia.
      style={{ touchAction: 'none' }}
    >
      <Suspense fallback={null}>
        <Background haloDir={HALO_DIR} />
        <Lighting shadows={quality.shadows} mapSize={quality.mapSize} />

        {/* El punto que enciende la rosa, antes de que exista. */}
        <CoreGlow tier={quality.tier} schedule={schedule} />

        {/* La estructura matemática: nace junto con la rosa y se desvanece
            a partir del 55 % del florecimiento, cediéndole sitio a la
            superficie. Después sólo aparece si el usuario la pide. */}
        <MathModel tier={quality.tier} schedule={schedule} mode={mode} />

        <MathematicalRose
          tier={quality.tier}
          schedule={schedule}
          phase={phase}
          mode={mode}
          reduced={reduced}
          onTap={onTap}
        />

        <RoseParticles enabled={quality.particles && !reduced} />

        <CameraRig
          bounds={boundsFor(quality.tier)}
          phase={phase}
          schedule={schedule}
          reduced={reduced}
          onFirstInteraction={onFirstInteraction}
        />

        {/*
          Los límites de distancia y los polos los fija CameraRig a partir del
          bounding box; aquí sólo se pone un rango inicial de la misma
          magnitud para que el primer frame no permita un zoom absurdo.
        */}
        <OrbitControls
          makeDefault
          enablePan={false}
          enableZoom
          enableRotate
          enableDamping
          dampingFactor={CAMERA.dampingFactor}
          rotateSpeed={0.7}
          zoomSpeed={0.6}
          minPolarAngle={(CAMERA.minPolarDeg * Math.PI) / 180}
          maxPolarAngle={(CAMERA.maxPolarDeg * Math.PI) / 180}
          minDistance={0.4}
          maxDistance={8}
          target={[0, 0, 0]}
        />

        <Effects enabled={quality.bloom && !reduced} />
        {overlay}
      </Suspense>
    </Canvas>
    </div>
  )
}