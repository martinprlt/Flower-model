import { Bloom, EffectComposer } from '@react-three/postprocessing'

import { RENDER } from '../../config'

/**
 * Postprocesado: sólo bloom, y sólo el suficiente para que el frente del
 * crecimiento y los highlights del petalo separen un poco del fondo.
 *
 * NO se aplica ToneMapping aquí. El tone mapping vive en el renderer (ACES,
 * exposición 0.92); si también se añade en el composer se aplica dos veces y
 * el carmesí se desatura hasta el rosa, que es exactamente el fallo que
 * quieres evitar cuando trabajas con rojos profundos.
 *
 * Tampoco hay aberración cromática, glitch ni lens flare: se quiere una escena
 * cinematográfica, no un demostración de GPU. El vignette va en CSS porque
 * no cuesta pasada de render.
 */
export function Effects({ enabled }: { enabled: boolean }) {
  if (!enabled) return null
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        mipmapBlur
        intensity={RENDER.bloomIntensity}
        luminanceThreshold={RENDER.bloomThreshold}
        luminanceSmoothing={RENDER.bloomSmoothing}
        radius={RENDER.bloomRadius}
      />
    </EffectComposer>
  )
}