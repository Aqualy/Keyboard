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
import { FolderRail, Folders } from './ui/Folders'
import { ArrowIcon } from './ui/icons'
import { Cinematic } from './ui/Cinematic'
import { OrbitHint, PartLabel, StageTools, TypeHint, VolumeLabel } from './ui/StageOverlay'

// The 3D code is the largest download, so it starts now rather than waiting for the first render.
const stageModule = import('./scene/Stage')
const Stage = lazy(() => stageModule.then(({ Stage }) => ({ default: Stage })))

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
function usePanelInset(mode: string, menuOpen: boolean) {
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
      // The camera keeps clear of the strip, or of the whole menu while it is folded out. The menu's
      // content keeps its full width while folded, so its edge is known before the slide ends.
      const rail = panel.querySelector<HTMLElement>('.rail')
      const content = panel.querySelector<HTMLElement>('.panel-content')
      let left = 0
      if (side && rail && content) {
        left = menuOpen
          ? panel.getBoundingClientRect().left +
            panel.clientLeft +
            content.offsetLeft +
            content.offsetWidth
          : rail.getBoundingClientRect().right
      }
      setStageInset(height, left)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(panel)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [mode, menuOpen, setStageInset])

  return { panelRef, panelHeight }
}

export default function App() {
  const mode = useStage((state) => state.mode)
  const ready = useStage((state) => state.ready)
  const dark = useStage(isDark)
  const knob = useStage((state) => state.knobHovered || state.knobActive)
  const supported = hasGraphicsSupport()
  // The side menu folds out while the pointer is over it, or keyboard focus is inside it.
  const [hovered, setHoveredNow] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const setHovered = (over: boolean) => {
    clearTimeout(closeTimer.current)
    if (over) setHoveredNow(true)
    else closeTimer.current = setTimeout(() => setHoveredNow(false), 160)
  }
  const [focused, setFocused] = useState(false)
  const menuOpen = hovered || focused
  const { panelRef, panelHeight } = usePanelInset(mode, menuOpen)
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
      <div
        className="panel"
        ref={panelRef}
        data-menu-open={menuOpen}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={(event) => setFocused(event.target.matches(':focus-visible'))}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false)
        }}
      >
        <FolderRail />
        <div className="panel-content">
          <Summary />
          <Folders />
        </div>
      </div>
    </main>
  )
}
