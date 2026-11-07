import type { KeyDefinition } from '../data/layout'
import type { PlateId } from '../data/options'

export type KeyEdge = 'press' | 'release'

const NAMED_KEYS: Record<string, string> = {
  Backspace: 'BACKSPACE',
  Enter: 'ENTER',
  Space: 'SPACE',
}

export const PRESS_SAMPLES = [
  'BACKSPACE',
  'ENTER',
  'SPACE',
  'GENERIC_R0',
  'GENERIC_R1',
  'GENERIC_R2',
  'GENERIC_R3',
  'GENERIC_R4',
]

export const RELEASE_SAMPLES = ['BACKSPACE', 'ENTER', 'SPACE', 'GENERIC']

/** Long keys have their own recording. Other presses are recorded per row. */
export function sampleName(key: Pick<KeyDefinition, 'code' | 'row'>, edge: KeyEdge) {
  const named = NAMED_KEYS[key.code]
  if (named) return `${edge}/${named}`
  return edge === 'press' ? `press/GENERIC_R${key.row}` : 'release/GENERIC'
}

export interface PlateTone {
  /** Playback speed, which also shifts pitch. */
  pitch: number
  /** Low-pass cutoff in Hz. A softer plate loses more of the top end. */
  cutoff: number
  gain: number
}

/** The recordings share one plate, so other plates are shaped from it. */
export const PLATE_TONES: Record<PlateId, PlateTone> = {
  pc: { pitch: 0.93, cutoff: 5200, gain: 0.95 },
  fr4: { pitch: 1, cutoff: 12000, gain: 1 },
  aluminium: { pitch: 1.07, cutoff: 18000, gain: 1 },
  brass: { pitch: 1.03, cutoff: 9000, gain: 1.1 },
}

/** Per-play humanisation, keeping repeated keys from sounding identical. */
export function playbackVariation(x: number, keyboardHalfWidth: number, roll = Math.random) {
  return {
    rate: 1 + (roll() - 0.5) * 0.09,
    gain: 0.86 + roll() * 0.14,
    pan: Math.max(-1, Math.min(1, x / keyboardHalfWidth)) * 0.45,
  }
}
