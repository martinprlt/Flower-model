import { PALETTE } from '../../config'

interface LightingProps {
  /** Sombras apagadas en el tier low: en móvil es el coste más alto de la escena. */
  shadows: boolean
  mapSize: number
}

/**
 * Iluminación cinematográfica, no demo de GPU.
 *
 *  · un ambiente casi apagado, para que haya negros de verdad;
 *  · una key cálida desde arriba/lateral, única fuente de sombra;
 *  · un fill rojizo muy suave que no sube los negros;
 *  · un rim trasero que separa la silueta del fondo oscuro.
 *
 * Las sombras están aquí por un motivo concreto: son lo que hace que se
 * distingan las capas de pétalos. Sin ellas la rosa se aplana en un rojo
 * homogéneo.
 */
export function Lighting({ shadows, mapSize }: LightingProps) {
  return (
    <>
      <ambientLight intensity={0.3} color={PALETTE.lightAmbient} />

      {/* Key: la única que proyecta sombra. */}
      <directionalLight
        position={[2.4, 4.2, 1.6]}
        intensity={2.9}
        color={PALETTE.lightKey}
        castShadow={shadows}
        shadow-mapSize-width={mapSize}
        shadow-mapSize-height={mapSize}
        shadow-bias={-0.0012}
        shadow-normalBias={0.02}
        // Caja ajustada al radio real de la rosa: si es demasiado grande la
        // resolución se desperdicia y el sombreado sale de bandas.
        shadow-camera-left={-1.6}
        shadow-camera-right={1.6}
        shadow-camera-top={1.6}
        shadow-camera-bottom={-1.6}
        shadow-camera-near={0.1}
        shadow-camera-far={12}
      />

      {/* Fill rojizo, sin proyectar. */}
      <pointLight position={[-3, 1.2, -1]} intensity={2.6} color={PALETTE.lightFill} distance={14} decay={2} />

      {/* Rim trasero: separa la silueta del fondo. */}
      <directionalLight position={[-1.5, 1.8, -3.2]} intensity={1.2} color={PALETTE.rim} />
    </>
  )
}