import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import katex from 'katex'

import { COPY } from '../../config'
import type { MathMode } from '../../state'

/**
 * Las ecuaciones de la rosa, tal como están implementadas en src/math/rose.ts.
 *
 * No es documentación de un trabajo ajeno: es exactamente lo que ejecuta la
 * aplicación. Si mañana cambia una fórmula, hay que cambiarla aquí también.
 */
const EQUATIONS: { title: string; tex: string }[] = [
  {
    title: 'Elevación del pétalo',
    tex: String.raw`\varphi(\theta) = \frac{\pi}{2}\,e^{-\frac{\theta}{8\pi}}`,
  },
  {
    title: 'Perfil de contorno de cada pétalo',
    tex: String.raw`X(\theta) = 1 - \frac{1}{2}\left[\frac{5}{4}\left(1 - \frac{\theta \bmod 2\pi}{\pi}\right)^{2} - \frac{1}{4}\right]^{2}`,
  },
  {
    title: 'Cómo recorre X el pétalo n',
    tex: String.raw`\theta = 2\pi\left(n + \tfrac{1}{2}q\right),\qquad q \in [0,1]`,
  },
  {
    title: 'Distribución de los pétalos',
    tex: String.raw`\beta_n = n\cdot\pi\left(3-\sqrt{5}\right) \approx n\cdot 137.507^{\circ}`,
  },
  {
    title: 'Espina del pétalo',
    tex: String.raw`\begin{aligned}
      r(q) &= r_{b} + L\,q^{\,e_{r}}\cos\varphi_k \\
      h(q) &= h_{b} - L\,q^{\,e_{h}}\sin\varphi_k
    \end{aligned}`,
  },
  {
    title: 'Marco de la sección',
    tex: String.raw`\vec e_1 = \begin{pmatrix}\cos\varphi\cos\beta\\ -\sin\varphi\\ \cos\varphi\sin\beta\end{pmatrix},
      \quad
      \vec e_2 = \begin{pmatrix}\sin\beta\\ 0\\ -\cos\beta\end{pmatrix},
      \quad
      \vec e_3 = \begin{pmatrix}\sin\varphi\cos\beta\\ \cos\varphi\\ \sin\varphi\sin\beta\end{pmatrix}`,
  },
  {
    title: 'Punto de la flor',
    tex: String.raw`\vec p = \begin{pmatrix} r\cos\beta \\ h \\ r\sin\beta \end{pmatrix}
      + \vec e_2\,w\sin\psi - \vec e_3\,c\,w\cos\psi`,
  },
]

function Equation({ tex }: { tex: string }) {
  const html = safeRender(tex)
  return <div className="eq" dangerouslySetInnerHTML={{ __html: html }} />
}

/**
 * KaTeX con throwOnError: false — si una fórmula fuera inválida se ve en
 * color de error en lugar de romper la pantalla entera.
 */
function safeRender(tex: string): string {
  try {
    return katex.renderToString(tex, {
      throwOnError: false,
      displayMode: true,
      strict: false,
      output: 'html',
    })
  } catch {
    return tex
  }
}

export interface MathPanelProps {
  open: boolean
  mode: MathMode
  onModeChange: (m: MathMode) => void
  onClose: () => void
}

export function MathPanel({ open, mode, onModeChange, onClose }: MathPanelProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  // Escape cierra, y el foco se va al botón de cierre al abrir: en un
  // modal hecho a mano eso es lo único que hace que sea operable con
  // teclado sin tener que montar un trampa de foco completa.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const t = window.setTimeout(() => closeRef.current?.focus(), 60)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.clearTimeout(t)
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="math-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.32, ease: 'easeOut' }}
          onClick={onClose}
        >
          <motion.div
            className="math-modal"
            role="dialog"
            aria-modal="true"
            aria-label={COPY.mathTitle}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 16, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.99 }}
            transition={{ duration: 0.36, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <button
              ref={closeRef}
              type="button"
              className="math-close"
              aria-label="Cerrar"
              onClick={onClose}
            >
              ×
            </button>

            <h2 className="math-title">{COPY.mathTitle}</h2>

            <div className="math-equations">
              {EQUATIONS.map((e) => (
                <div key={e.title} className="math-equation">
                  <p className="math-equation__label">{e.title}</p>
                  <Equation tex={e.tex} />
                </div>
              ))}
            </div>

            <p className="math-blurb">{COPY.mathBlurb}</p>

            <div className="mode-select" role="tablist" aria-label="Representación">
              <ModeTab active={mode === 'rosa'} onClick={() => onModeChange('rosa')}>
                {COPY.modeRose}
              </ModeTab>
              <ModeTab active={mode === 'matematica'} onClick={() => onModeChange('matematica')}>
                {COPY.modeMath}
              </ModeTab>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`mode-tab${active ? ' is-active' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}