import { useRef, useState } from 'react'
import { motion } from 'framer-motion'

import { AUDIO, COPY } from '../../config'

/**
 * El botón π.
 *
 * Es la única puerta de entrada a la matemática, y está deliberadamente
 * escrito en una esquina semitransparente: no es un call-to-action, es algo
 * que se encuentra. La experiencia tiene que entenderse sin abrirlo.
 */
export function MathButton({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      className="corner-btn corner-btn--math"
      aria-label={COPY.mathTitle}
      onClick={onClick}
      initial={{ opacity: 0 }}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 1, ease: 'easeInOut' }}
      // Con opacity 0 sigue siendo focalizable con Tab, lo que daría un foco
      // invisible; se desactiva de verdad cuando no se ve.
      disabled={!visible}
      tabIndex={visible ? 0 : -1}
    >
      π
    </motion.button>
  )
}

/**
 * El botón de música.
 *
 * Nunca se reproduce nada automáticamente: los navegadores móviles lo
 * bloquean y además sería invasivo. Sin pista configurada en
 * `AUDIO.trackUrl` aparece deshabilitado y la aplicación funciona igual, sin
 * haber cargado un solo byte de audio.
 */
export function AudioToggle({ visible }: { visible: boolean }) {
  const [on, setOn] = useState(false)
  const [failed, setFailed] = useState(false)
  const ref = useRef<HTMLAudioElement | null>(null)

  const hasTrack = AUDIO.trackUrl !== null
  if (!hasTrack || failed) return null

  const toggle = () => {
    if (AUDIO.trackUrl === null) return
    if (!ref.current) {
      const a = new Audio(AUDIO.trackUrl)
      a.loop = true
      a.volume = 0.35
      ref.current = a
    }
    const a = ref.current
    if (on) {
      a.pause()
      setOn(false)
      return
    }
    // Puede rechazarse aunque lo haya pedido el usuario (p. ej. gesto no
    // válido en iOS). Si falla, el botón se oculta y punto.
    a.play()
      .then(() => setOn(true))
      .catch(() => setFailed(true))
  }

  return (
    <motion.button
      type="button"
      className={`corner-btn corner-btn--audio${on ? ' is-on' : ''}`}
      aria-label={COPY.audio}
      aria-pressed={on}
      onClick={toggle}
      initial={{ opacity: 0 }}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 1, ease: 'easeInOut' }}
      disabled={!visible}
      tabIndex={visible ? 0 : -1}
    >
      ♪
    </motion.button>
  )
}