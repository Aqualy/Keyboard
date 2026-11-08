import {
  Component,
  lazy,
  Suspense,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { COLOURWAYS } from './data/options'
import { layoutOf, matchColourway, useConfig } from './state/config'
import { keysetOf } from './data/keysets'
import { isDark, useStage } from './state/stage'
import { TypingTest } from './test/TypingTest'
import { Folders } from './ui/Folders'
import { ArrowIcon } from './ui/icons'
import { Cinematic } from './ui/Cinematic'
import { SwitchCutaway } from './ui/SwitchCutaway'
import { OrbitHint, PartLabel, StageTools, VolumeLabel } from './ui/StageOverlay'

const Stage = lazy(() => import('./scene/Stage').then(({ Stage }) => ({ default: Stage })))

function hasGraphicsSupport() {
  if ('gpu' in navigator) return true
  return document.createElement('canvas').getContext('webgl2') !== null
}

function StageMessage({ children }: { children: ReactNode }) {
  return (
    <p className="stage-message" role="status">
      {children}
    </p>
  )
}

class StageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <StageMessage>The 3D keyboard could not load. Reload the page to try again.</StageMessage>
      )
    }
    return this.props.children
  }
}

function Summary() {
  const config = useConfig((state) => state.config)
  const setMode = useStage((state) => state.setMode)
  const preset = matchColourway(config)
  const keyset = keysetOf(config.keyset)
  const colourway = keyset?.name ?? COLOURWAYS.find((way) => way.id === preset)?.name ?? 'Custom'
  return (
    <header className="summary">
      <div>
        <h1>{layoutOf(config).name}</h1>
        <p>{colourway}</p>
      </div>
      <button type="button" className="test-button" onClick={() => setMode('test')}>
        <span>Test</span>
        <ArrowIcon />
      </button>
    </header>
  )
}

/**
 * Measures the panel floating over the stage. The camera keeps the board above the folders, and
 * on narrow screens above the whole panel, where the title row spans the width.
 */
function usePanelInset(mode: string) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelHeight, setPanelHeight] = useState(0)
  const setStageInset = useStage((state) => state.setStageInset)

  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const measure = () => {
      const floating =
        getComputedStyle(panel).position === 'absolute' && mode !== 'test' && mode !== 'cinematic'
      const folders = panel.querySelector<HTMLElement>('.folders')
      const wide = window.innerWidth > 1000
      const height = floating ? panel.offsetHeight : 0
      setPanelHeight(height)
      setStageInset(floating ? (wide && folders ? folders.offsetHeight + 12 : height) : 0)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(panel)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [mode, setStageInset])

  return { panelRef, panelHeight }
}

export default function App() {
  const mode = useStage((state) => state.mode)
  const ready = useStage((state) => state.ready)
  const dark = useStage(isDark)
  const switchesOpen = useStage(
    (state) => state.mode === 'configure' && state.section === 'switches',
  )
  const knob = useStage((state) => state.knobHovered || state.knobActive)
  const supported = hasGraphicsSupport()
  const { panelRef, panelHeight } = usePanelInset(mode)
  const stageInset = useStage((state) => state.stageInset)
  const insets = {
    '--panel-height': `${panelHeight}px`,
    '--stage-inset': `${stageInset}px`,
  } as CSSProperties

  return (
    <main
      className="app"
      data-mode={mode}
      data-ready={ready}
      data-dark={dark}
      data-knob={knob}
      style={insets}
    >
      <div className="stage">
        {supported ? (
          <StageBoundary>
            <Suspense fallback={null}>
              <Stage />
            </Suspense>
            {!ready && <StageMessage>Loading</StageMessage>}
          </StageBoundary>
        ) : (
          <StageMessage>
            This keyboard needs 3D graphics, which this browser has turned off. Try another browser.
          </StageMessage>
        )}
        {supported && ready && (
          <>
            <OrbitHint />
            <StageTools />
            <PartLabel />
            <VolumeLabel />
            {switchesOpen && <SwitchCutaway className="cutaway-stage" />}
          </>
        )}
        {mode === 'test' && <TypingTest />}
        {mode === 'cinematic' && <Cinematic />}
      </div>
      <div className="panel" ref={panelRef}>
        <Summary />
        <Folders />
      </div>
    </main>
  )
}
