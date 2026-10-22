import { AnimatePresence, motion } from 'framer-motion'

import { COPY } from '../../config'

/**
 * El mensaje final.
 *
 * Tres bloques con jerarquías muy distintas: el mensaje es lo único que
 * importa, la dedicatoria está debajo en un tamaño pequeño y la firma es casi
 * un detalle. Esa diferencia de escala es lo que hace que se lea como una
 * nota y no como un titular.
 */
export function Dedication({ visible, durationMs }: { visible: boolean; durationMs: number }) {
  const duration = Math.max(durationMs / 1000, 0.05)
  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="dedication"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration, ease: [0.22, 0.61, 0.36, 1] }}
          aria-live="polite"
        >
          <p className="dedication__message">{COPY.message}</p>
          <p className="dedication__to">{COPY.dedication}</p>
          <p className="dedication__from">{COPY.signoff}</p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}