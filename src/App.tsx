import { Component, lazy, Suspense, type ReactNode } from 'react'
import { COLOURWAYS } from './data/options'
import { matchColourway, useConfig } from './state/config'
import { useStage } from './state/stage'
import { TypingTest } from './test/TypingTest'
import { Cards } from './ui/Cards'
import { ArrowIcon } from './ui/icons'
import { OrbitHint, PartLabel, StageTools } from './ui/StageOverlay'

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
        <h1>GMK67</h1>
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
  const supported = hasGraphicsSupport()

  return (
    <main className="app" data-mode={mode} data-ready={ready}>
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
          </>
        )}
        {mode === 'test' && <TypingTest />}
      </div>
      <div className="panel">
        <Summary />
        <Cards />
      </div>
    </main>
  )
}
