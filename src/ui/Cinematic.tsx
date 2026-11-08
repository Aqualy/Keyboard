import { useEffect } from 'react'
import { useStage } from '../state/stage'

/**
 * Cinematic mode's only visible parts: letterbox bars, the dip to black between shots (driven
 * from the camera), and a hint that fades once read. Any click, tap or Esc ends it.
 */
export function Cinematic() {
  const setMode = useStage((state) => state.setMode)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMode('configure')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setMode])

  return (
    <div
      className="cinema"
      role="button"
      tabIndex={0}
      aria-label="Leave cinematic mode"
      onPointerDown={() => setMode('configure')}
    >
      <div className="cinema-fade" aria-hidden="true" />
      <p className="cinema-hint">Click or press Esc to leave</p>
    </div>
  )
}
