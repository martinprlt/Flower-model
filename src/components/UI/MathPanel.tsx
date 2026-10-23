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
    title: 'Elevación a lo largo del pétalo',
    tex: String.raw`\begin{aligned}
      \psi(q) &= \varphi\!\left(\theta(k_h)\right) + \lambda(k_h)\,q - \kappa(k_h)\,q^{2} \\
      \kappa(k_h) &= \kappa_0\left[\chi(1-k_h)^{2} + \left(1-\chi(1-k_h)^{2}\right)k_h^{1.6}\right] \\
      \lambda(k_h) &= \lambda_0\max\!\left(0,\,1-\tfrac{k_h}{0.5}\right)^{2}
    \end{aligned}`,
  },
  {
    title: 'Perfil de contorno de cada pétalo',
    tex: String.raw`\begin{aligned}
      X(\theta) &= 1 - \frac{1}{2}\left[\frac{5}{4}\left(1 - \frac{\theta \bmod 2\pi}{\pi}\right)^{2} - \frac{1}{4}\right]^{2} \\
      W(q) &= L\,w\left[0.52 + 0.48\sin\!\left(\pi q^{0.8}\right)\right]\left(0.8 + 0.2\,X_n\right)
    \end{aligned}`,
  },
  {
    title: 'Cómo recorre X el pétalo n',
    tex: String.raw`\theta = 2\pi\left(n + \tfrac{1}{2}q\right),\qquad q \in [0,1],\qquad X_n = \frac{X-0.5}{0.5}`,
  },
  {
    title: 'Reparto de los pétalos en verticilos',
    tex: String.raw`\beta_0 = \frac{2\pi\,(j + \rho_k)}{m_k} + 0.45\left(1-k_h\right)^{2}q,\qquad j = 0 \dots m_k - 1`,
  },
  {
    title: 'Espina del pétalo (tangente integrada)',
    tex: String.raw`\begin{aligned}
      r(q) &= r_{b}(k_h) + L\int_{0}^{q}\cos\psi(s)\,\mathrm{d}s \\
      h(q) &= h_{b}(k_h) + L\int_{0}^{q}\sin\psi(s)\,\mathrm{d}s
    \end{aligned}`,
  },
  {
    title: 'Receptáculo que cierra el ápice',
    tex: String.raw`\begin{aligned}
      r_b(k_h) &= r_{\min} + (r_{\max}-r_{\min})\sin\!\left(\chi_{\max}k_h^{1.35}\right) \\
      h_b(k_h) &= y_{\text{top}} - y_{\text{drop}}\left[1-\cos\!\left(\chi_{\max}k_h^{1.35}\right)\right]
    \end{aligned}`,
  },
  {
    title: 'Marco de la sección',
    tex: String.raw`\vec e_1 = \begin{pmatrix}\cos\psi\cos\beta\\ \sin\psi\\ \cos\psi\sin\beta\end{pmatrix},
      \quad
      \vec e_2 = \begin{pmatrix}\sin\beta\\ 0\\ -\cos\beta\end{pmatrix},
      \quad
      \vec e_3 = \begin{pmatrix}-\sin\psi\cos\beta\\ \cos\psi\\ -\sin\psi\sin\beta\end{pmatrix}`,
  },
  {
    title: 'Punto de la flor y envoltura del capullo',
    tex: String.raw`\begin{aligned}
      d &= \left(c\cos\psi_s - \rho_{\text{ref}}\right)W(q)\sin\!\left(\tfrac{q^{0.45}\pi}{2}\right) \\
      \ell &= W(q)\sin\!\left(\tfrac{q^{0.45}\pi}{2}\right)\sin\psi_s \\
      B &= S\!\left(S\!\left(\max\!\left(0,1-\tfrac{k_h}{0.5}\right)\right)\right),\quad S(t)=t^{2}(3-2t) \\
      \rho &= \sqrt{(r+d)^{2} + (B\ell)^{2}},\qquad \alpha = \beta + \operatorname{atan2}\!\left(B\ell,\,r+d\right) \\
      \vec p &= \begin{pmatrix}\rho\cos\alpha\\ h + \vec e_3\cdot d\\ \rho\sin\alpha\end{pmatrix}
    \end{aligned}`,
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