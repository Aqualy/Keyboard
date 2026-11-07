import { KEY_BY_CODE } from '../data/layout'

const CONTROL_KEYS = new Set([
  'Tab',
  'Enter',
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
])

/**
 * Whether a physical key should press its 3D twin. A focused control keeps its
 * navigation keys, but typing letters after clicking a pill still works.
 */
export function shouldPressKey(event: {
  code: string
  repeat: boolean
  target: EventTarget | null
}) {
  if (event.repeat || !KEY_BY_CODE.has(event.code)) return false
  const element = event.target instanceof HTMLElement ? event.target : null
  if (element?.dataset.typing !== undefined) return true
  const inControl = element?.closest('input, button, select, textarea, a') != null
  return !(inControl && CONTROL_KEYS.has(event.code))
}

export interface KeySink {
  press: (code: string) => void
  release: (code: string) => void
}

/** Tracks held keys so each press gets exactly one release, even if focus is lost. */
export function createKeyTracker(sink: KeySink) {
  const held = new Set<string>()
  return {
    down(code: string) {
      if (held.has(code)) return
      held.add(code)
      sink.press(code)
    },
    up(code: string) {
      if (held.delete(code)) sink.release(code)
    },
    releaseAll() {
      for (const code of held) sink.release(code)
      held.clear()
    },
  }
}
