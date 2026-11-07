import { Component, lazy, Suspense, type ReactNode } from 'react'
import { COLOURWAYS } from './data/options'
import { layoutOf, matchColourway, useConfig } from './state/config'
import { isDark, useStage } from './state/stage'
import { TypingTest } from './test/TypingTest'
import { Folders } from './ui/Folders'
import { ArrowIcon } from './ui/icons'
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
  const colourway = COLOURWAYS.find((way) => way.id === preset)?.name ?? 'Custom'
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

export default function App() {
  const mode = useStage((state) => state.mode)
  const ready = useStage((state) => state.ready)
  const dark = useStage(isDark)
  const switchesOpen = useStage(
    (state) => state.mode === 'configure' && state.section === 'switches',
  )
  const knob = useStage((state) => state.knobHovered || state.knobActive)
  const supported = hasGraphicsSupport()

  return (
    <main className="app" data-mode={mode} data-ready={ready} data-dark={dark} data-knob={knob}>
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
      </div>
      <div className="panel">
        <Summary />
        <Folders />
      </div>
    </main>
  )
}
