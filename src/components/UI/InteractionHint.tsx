import { AnimatePresence, motion } from 'framer-motion'

import { COPY } from '../../config'

export interface InteractionHintProps {
  visible: boolean
  onDismiss: () => void
}

/**
 * "Arrástrala · tócala".
 *
 * Se muestra una sola vez, después de que la rosa termine de formarse, y se
 * va de dos formas: pasados unos segundos, o en cuanto el usuario toca la
 * flor. Nunca vuelve a aparecer.
 */
export function InteractionHint({ visible, onDismiss }: InteractionHintProps) {
  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="hint"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          onPointerDown={onDismiss}
        >
          {COPY.hint}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}