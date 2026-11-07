import { useStage } from '../state/stage'
import { ExplodeIcon, OrbitIcon, ResetIcon, SoundOffIcon, SoundOnIcon } from './icons'

export function StageTools() {
  const mode = useStage((state) => state.mode)
  const soundOn = useStage((state) => state.soundOn)
  const setMode = useStage((state) => state.setMode)
  const resetView = useStage((state) => state.resetView)
  const toggleSound = useStage((state) => state.toggleSound)
  const exploded = mode === 'exploded'

  return (
    <div className="tools">
      {mode !== 'test' && (
        <button
          type="button"
          className="tool"
          aria-label={exploded ? 'Assemble keyboard' : 'Explode keyboard'}
          aria-pressed={exploded}
          title={exploded ? 'Assemble' : 'Explode'}
          onClick={() => setMode(exploded ? 'configure' : 'exploded')}
        >
          <ExplodeIcon />
        </button>
      )}
      {mode !== 'test' && (
        <button
          type="button"
          className="tool"
          aria-label="Reset view"
          title="Reset view"
          onClick={resetView}
        >
          <ResetIcon />
        </button>
      )}
      <button
        type="button"
        className="tool"
        aria-label={soundOn ? 'Mute sound' : 'Turn sound on'}
        aria-pressed={!soundOn}
        title={soundOn ? 'Mute' : 'Sound on'}
        onClick={toggleSound}
      >
        {soundOn ? <SoundOnIcon /> : <SoundOffIcon />}
      </button>
    </div>
  )
}

export function OrbitHint() {
  const hasOrbited = useStage((state) => state.hasOrbited)
  const mode = useStage((state) => state.mode)
  const hidden = hasOrbited || mode === 'test'
  return (
    <div className="orbit-hint" data-hidden={hidden} aria-hidden={hidden}>
      <OrbitIcon />
      <span>360°</span>
    </div>
  )
}

/** The volume while the knob turns, shown where it is being turned. */
export function VolumeLabel() {
  const at = useStage((state) => state.volumeLabel)
  const volume = useStage((state) => state.volume)
  if (!at) return null
  return (
    <div className="part-label" role="status" style={{ left: at.x, top: at.y }}>
      Volume {Math.round(volume * 100)}%
    </div>
  )
}

export function PartLabel() {
  const part = useStage((state) => state.hoveredPart)
  if (!part) return null
  return (
    <div className="part-label" role="status" style={{ left: part.x, top: part.y }}>
      {part.label}
    </div>
  )
}
