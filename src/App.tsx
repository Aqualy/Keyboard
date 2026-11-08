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
import { PRESETS } from './data/options'
import { layoutOf, matchPreset, useConfig } from './state/config'
import { keysetOf } from './data/keysets'
import { isDark, useStage } from './state/stage'
import { TypingTest } from './test/TypingTest'
import { Folders } from './ui/Folders'
import { ArrowIcon } from './ui/icons'
import { Cinematic } from './ui/Cinematic'
import { OrbitHint, PartLabel, StageTools, TypeHint, VolumeLabel } from './ui/StageOverlay'
import { ChevronIcon } from './ui/icons'

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
  const preset = PRESETS.find((candidate) => candidate.id === matchPreset(config))
  // A keycap set on another case still reads by the set's name.
  const look = preset?.name ?? keysetOf(config.keyset)?.name ?? 'Custom'
  return (
    <header className="summary">
      <div>
        <h1>{layoutOf(config).name}</h1>
        <p>{look}</p>
      </div>
      <button type="button" className="test-button" onClick={() => setMode('test')}>
        <span>Test</span>
        <ArrowIcon />
      </button>
    </header>
  )
}

/** Wide screens put the panel in a full-height column down the left. Matches index.css. */
const SIDE_PANEL = '(min-width: 1001px) and (min-height: 501px)'

/**
 * Measures the panel floating over the stage. The camera keeps the board beside the side panel on
 * wide screens, and above the whole panel on narrow ones, where it spans the bottom.
 */
function usePanelInset(mode: string, folded: boolean) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelHeight, setPanelHeight] = useState(0)
  const setStageInset = useStage((state) => state.setStageInset)

  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const measure = () => {
      const floating =
        getComputedStyle(panel).position === 'absolute' && mode !== 'test' && mode !== 'cinematic'
      const side = floating && window.matchMedia(SIDE_PANEL).matches
      const height = floating && !side ? panel.offsetHeight : 0
      setPanelHeight(height)
      setStageInset(height, side && !folded ? panel.offsetWidth : 0)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(panel)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [mode, folded, setStageInset])

  return { panelRef, panelHeight }
}

export default function App() {
  const mode = useStage((state) => state.mode)
  const ready = useStage((state) => state.ready)
  const dark = useStage(isDark)
  const knob = useStage((state) => state.knobHovered || state.knobActive)
  const supported = hasGraphicsSupport()
  const folded = useStage((state) => state.panelFolded)
  const togglePanel = useStage((state) => state.togglePanel)
  const { panelRef, panelHeight } = usePanelInset(mode, folded)
  const stageInset = useStage((state) => state.stageInset)
  const stageInsetLeft = useStage((state) => state.stageInsetLeft)
  const insets = {
    '--panel-height': `${panelHeight}px`,
    '--stage-inset': `${stageInset}px`,
    '--stage-inset-left': `${stageInsetLeft}px`,
  } as CSSProperties

  return (
    <main
      className="app"
      data-mode={mode}
      data-ready={ready}
      data-dark={dark}
      data-knob={knob}
      data-folded={folded}
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
            <div className="hints">
              <OrbitHint />
              <TypeHint />
            </div>
            <StageTools />
            <PartLabel />
            <VolumeLabel />
          </>
        )}
        {mode === 'test' && <TypingTest />}
        {mode === 'cinematic' && <Cinematic />}
      </div>
      <div className="panel" ref={panelRef}>
        {/* Folds the side panel away for a clear view of the board, and back. */}
        <button
          type="button"
          className="panel-fold"
          aria-label={folded ? 'Show controls' : 'Hide controls'}
          aria-expanded={!folded}
          title={folded ? 'Show controls' : 'Hide controls'}
          onClick={togglePanel}
        >
          <ChevronIcon direction={folded ? 'right' : 'left'} />
        </button>
        <Summary />
        <Folders />
      </div>
    </main>
  )
}
