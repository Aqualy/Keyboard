import type { KeyDefinition } from '../data/layout'
import type { PlateId, SwitchId } from '../data/options'
import LOUDNESS from './loudness.json'

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

const GENERIC = (name: string) => name.startsWith('GENERIC')

/** Every recording a switch has, relative to its sound folder. */
export function samplePaths(longKeySamples: boolean) {
  const include = (name: string) => longKeySamples || GENERIC(name)
  return [
    ...PRESS_SAMPLES.filter(include).map((name) => `press/${name}`),
    ...RELEASE_SAMPLES.filter(include).map((name) => `release/${name}`),
  ]
}

/** Long keys have their own recording if the switch has one. Other presses vary by row. */
export function sampleName(
  key: Pick<KeyDefinition, 'code' | 'row'>,
  edge: KeyEdge,
  longKeySamples = true,
) {
  const named = NAMED_KEYS[key.code]
  if (named && longKeySamples) return `${edge}/${named}`
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

/**
 * Every switch plays at this loudness, so changing switch changes the character, not the
 * volume. It is set by the quietest set (Topre), which needs the most boost, so that none
 * of them clips. Measured by `node tools/measure-loudness.mjs`.
 */
export const TARGET_LUFS = -37.5

export interface SwitchLoudness {
  /** Integrated loudness of the typing recordings. */
  lufs: number
  /** Highest sample of any recording, in dBFS. */
  peak: number
}

export const SWITCH_LOUDNESS: Record<SwitchId, SwitchLoudness> = LOUDNESS

/** Linear gain that brings a switch's recordings to the shared loudness. */
export function switchGain(id: SwitchId) {
  return 10 ** ((TARGET_LUFS - SWITCH_LOUDNESS[id].lufs) / 20)
}

/** Per-play humanisation, keeping repeated keys from sounding identical. */
export function playbackVariation(x: number, keyboardHalfWidth: number, roll = Math.random) {
  return {
    rate: 1 + (roll() - 0.5) * 0.09,
    gain: 0.86 + roll() * 0.14,
    pan: Math.max(-1, Math.min(1, x / keyboardHalfWidth)) * 0.45,
  }
}

/** Kept before the first loud sample, so the start of the click itself is never cut. */
const ONSET_LEAD_SECONDS = 0.002

/**
 * Where a recording's sound starts, in seconds. Several recordings open with up to 60 ms of
 * silence, plus the MP3 decoder's own padding, which made those keys sound late. Playback skips it.
 */
export function soundOnset(samples: Float32Array, sampleRate: number) {
  let peak = 0
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample))
  const threshold = Math.max(0.004, peak * 0.03)
  const first = samples.findIndex((sample) => Math.abs(sample) >= threshold)
  if (first <= 0) return 0
  return Math.max(0, first / sampleRate - ONSET_LEAD_SECONDS)
}
