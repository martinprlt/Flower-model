import { AnimatePresence, motion } from 'framer-motion'

/**
 * La frase de apertura.
 *
 * opacity + unos pocos píxeles de movimiento vertical + un desenfoque que
 * desaparece. Nada más: la frase entra, respira y se va, y deja la pantalla en
 * negro un momento antes de que aparezca el punto.
 *
 * Está en el DOM y no en el lienzo, para que sea seleccionable, legible por
 * lectores de pantalla y no tenga que redibujarse cada frame.
 */
export function Intro({ text, visible }: { text: string; visible: boolean }) {
  return (
    <AnimatePresence>
      {visible ? (
        <motion.p
          key="intro"
          className="intro-text"
          aria-live="polite"
          initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -6, filter: 'blur(5px)' }}
          transition={{ duration: 1.1, ease: [0.22, 0.61, 0.36, 1] }}
        >
          {text}
        </motion.p>
      ) : null}
    </AnimatePresence>
  )
}