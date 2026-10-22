import { motion } from 'framer-motion'

import { COPY, PALETTE } from '../../config'

/**
 * El "loader".
 *
 * No es un spinner: es un punto rojo tenue que respira. La experiencia no
 * empieza hasta que la escena está preparada, y mientras tanto eso es todo lo
 * que hay en pantalla — no hay logotipo, ni barra, ni porcentaje.
 */
export function LoadingDot({ visible }: { visible: boolean }) {
  return (
    <motion.div
      className="loading-dot"
      role="status"
      aria-label={COPY.loading}
      initial={false}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.6, ease: 'easeInOut' }}
      style={{ pointerEvents: 'none' }}
    >
      <motion.span
        style={{ background: PALETTE.core }}
        animate={{ opacity: [0.25, 0.75, 0.25], scale: [0.82, 1, 0.82] }}
        transition={{ duration: 1.6, ease: 'easeInOut', repeat: Infinity }}
      />
    </motion.div>
  )
}