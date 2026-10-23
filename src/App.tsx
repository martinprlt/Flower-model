import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { AUDIO, COPY } from './config'
import { Experience } from './components/Experience'
import { DebugHelpers } from './components/Scene/DebugPanel'
import { AudioToggle, MathButton } from './components/UI/CornerButtons'
import { DebugReadout } from './components/UI/DebugReadout'
import { Dedication } from './components/UI/Dedication'
import { InteractionHint } from './components/UI/InteractionHint'
import { Intro } from './components/UI/Intro'
import { LoadingDot } from './components/UI/LoadingDot'
import { MathPanel } from './components/UI/MathPanel'
import { useQuality } from './hooks/useQuality'
import { useReducedMotion } from './hooks/useReducedMotion'
import { getRose } from './math/geometry'
import { makeSchedule, mathReveal, roseGrow, timeline, type MathMode, type Phase } from './state'

type Schedule = ReturnType<typeof makeSchedule>

/**
 * Duración de cada fase. Un solo sitio: el rAF de más abajo es el único
 * programa que decide cuándo pasa algo. No hay un solo setTimeout repartido
 * por los componentes.
 */
function phaseDuration(phase: Phase, s: Schedule): number {
  switch (phase) {
    case 'LOADING':
      return 0
    case 'INTRO':
      return s.introDark + s.introHold + s.introGap + s.glowLead
    case 'GROWING':
      return s.grow
    case 'BLOOMED':
      return s.bloomHold + s.pushIn
    case 'INTERACTIVE':
      return Infinity
  }
}

const NEXT: Record<Phase, Phase> = {
  LOADING: 'INTRO',
  INTRO: 'GROWING',
  GROWING: 'BLOOMED',
  BLOOMED: 'INTERACTIVE',
  INTERACTIVE: 'INTERACTIVE',
}

export default function App() {
  const reduced = useReducedMotion()
  const quality = useQuality()
  const schedule = useMemo(() => makeSchedule(reduced), [reduced])
  const debug = useMemo(
    () =>
      typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug'),
    [],
  )

  const [ready, setReady] = useState(false)
  const [phase, setPhase] = useState<Phase>('LOADING')
  const [showIntroText, setShowIntroText] = useState(false)
  const [showDedication, setShowDedication] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [hintDismissed, setHintDismissed] = useState(false)
  const [touched, setTouched] = useState(false)
  const [mathOpen, setMathOpen] = useState(false)
  const [mode, setMode] = useState<MathMode>('rosa')

  // Guardas: sin ellas el rAF llamaría a setState 60 veces por segundo con el
  // mismo valor. React hace bailout igualmente, pero no hay motivo para
  // entrar en el ciclo de re-render.
  const introRef = useRef(false)
  const hintRef = useRef(false)
  const dedRef = useRef(false)

  // ── Arranque ──────────────────────────────────────────────────────────────
  // La geometría se construye dentro de un rAF, no en el primer render: son
  // ~140 ms en high. Si se hicieran durante el render, el punto de carga no
  // llegaría a verse y el primer pintado se retrasaría.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      getRose(quality.tier)
      timeline.now = performance.now()
      const url = new URLSearchParams(window.location.search)
      const skip = url.get('skip') === 'true'
      if (skip) {
        timeline.phase = 'INTERACTIVE'
        timeline.enteredAt = timeline.now - schedule.grow - 10000
        setReady(true)
        setPhase('INTERACTIVE')
        setShowDedication(true)
      } else {
        timeline.phase = 'INTRO'
        timeline.enteredAt = timeline.now
        setReady(true)
        setPhase('INTRO')
      }
    })
    return () => cancelAnimationFrame(id)
  }, [quality.tier])

  // ── Reloj único ───────────────────────────────────────────────────────────
  useEffect(() => {
    // Mientras no haya escena no hay nada que cronometrar. Sin esta guarda el
    // reloj arrancaría con phase = LOADING (duración 0) y adelantaría la
    // secuencia en el mismo frame en que la secuencia arrancaba.
    if (phase === 'LOADING') return

    let raf = 0
    // FPS medido por el propio reloj: es el mismo rAF que pinta la escena, así
    // que no hace falta un segundo bucle. Sólo se publica con ?debug.
    let frames = 0
    let fpsMark = performance.now()
    let fps = 0
    const tick = () => {
      const now = performance.now()
      frames++
      if (now - fpsMark >= 500) {
        fps = Math.round((frames * 1000) / (now - fpsMark))
        frames = 0
        fpsMark = now
      }
      timeline.now = now
      const t = now - timeline.enteredAt

      const textWanted =
        phase === 'INTRO' &&
        t >= schedule.introDark &&
        t < schedule.introDark + schedule.introHold
      if (introRef.current !== textWanted) {
        introRef.current = textWanted
        setShowIntroText(textWanted)
      }

      const hintWanted =
        phase === 'INTERACTIVE' && !hintDismissed && !touched && t < schedule.hintLife
      if (hintRef.current !== hintWanted) {
        hintRef.current = hintWanted
        setShowHint(hintWanted)
      }

      const dedWanted = phase === 'INTERACTIVE'
      if (dedRef.current !== dedWanted) {
        dedRef.current = dedWanted
        setShowDedication(dedWanted)
      }

      // Estado legible desde fuera para el diagnóstico headless
      // (scripts/probe.mjs). Sólo existe con ?debug=true.
      if (debug) {
        ;(window as unknown as Record<string, unknown>).__ROSE_DEBUG__ = {
          phase,
          phaseMs: Math.round(t),
          grow: Number(roseGrow(schedule).toFixed(3)),
          mathReveal: Number(mathReveal(schedule, mode).toFixed(3)),
          showIntroText,
          showDedication,
          showHint,
          mode,
          reduced,
          fps,
          tier: quality.tier,
          dpr: quality.dpr,
          shadows: quality.shadows,
          bloom: quality.bloom,
        }
      }

      if (t >= phaseDuration(phase, schedule)) {
        const next = NEXT[phase]
        if (next !== phase) {
          timeline.phase = next
          timeline.enteredAt = now
          setPhase(next)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase, schedule, hintDismissed, touched])

  const onFirstInteraction = useCallback(() => setTouched(true), [])
  const onTap = useCallback(() => setHintDismissed(true), [])
  const dismissHint = useCallback(() => setHintDismissed(true), [])

  // Dentro del Canvas sólo van objetos de three.
  const overlay: ReactNode = debug ? <DebugHelpers tier={quality.tier} /> : null

  return (
    <div className="app">
      {ready ? (
        <Experience
          quality={quality}
          schedule={schedule}
          phase={phase}
          mode={mode}
          reduced={reduced}
          onFirstInteraction={onFirstInteraction}
          onTap={onTap}
          overlay={overlay}
        />
      ) : null}

      {/* Vignette en CSS: no cuesta pasada de render y se aplica por encima
          de todo, incluido el bloom. */}
      <div className="vignette" aria-hidden="true" />

      <LoadingDot visible={!ready} />
      <Intro text={COPY.introLead} visible={showIntroText} />
      <Dedication visible={showDedication} durationMs={schedule.messageFade} />
      <InteractionHint visible={showHint} onDismiss={dismissHint} />

      <div className="corners">
        <AudioToggle visible={ready && AUDIO.trackUrl !== null} />
        <MathButton
          visible={phase === 'INTERACTIVE' && !mathOpen}
          onClick={() => setMathOpen(true)}
        />
      </div>

      <MathPanel
        open={mathOpen}
        mode={mode}
        onModeChange={setMode}
        onClose={() => setMathOpen(false)}
      />

      {/* El panel de texto es HTML: vive fuera del Canvas, no dentro. */}
      {debug ? <DebugReadout quality={quality} /> : null}
    </div>
  )
}