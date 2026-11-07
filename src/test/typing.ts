import { withLegends } from '../data/layout'
import { layoutOf, useConfig } from '../state/config'

export const PHRASES = [
  'the quick brown fox jumps over the lazy dog near the quiet river bank',
  'pack my box with five dozen liquor jugs before the morning train leaves',
  'how vexingly quick daft zebras jump while the small band plays all night',
  'sphinx of black quartz judge my vow and then tell me what it means',
  'a good keyboard makes every sentence feel a little more worth writing down',
  'typing slowly at first builds the accuracy that speed will later depend on',
]

export interface TypingState {
  target: string
  typed: string
  /** Every character entered, including ones later corrected. */
  keystrokes: number
  mistakes: number
  /** Each character typed, with the one the phrase wanted there. */
  strokes: { typed: string; expected: string }[]
  startedAt: number | null
  finishedAt: number | null
}

export const startTyping = (target: string): TypingState => ({
  target,
  typed: '',
  keystrokes: 0,
  mistakes: 0,
  strokes: [],
  startedAt: null,
  finishedAt: null,
})

export function typeCharacter(state: TypingState, character: string, now: number): TypingState {
  if (state.finishedAt !== null || state.typed.length >= state.target.length) return state
  const typed = state.typed + character
  const expected = state.target[state.typed.length]
  const correct = expected === character
  return {
    ...state,
    typed,
    keystrokes: state.keystrokes + 1,
    mistakes: state.mistakes + (correct ? 0 : 1),
    strokes: [...state.strokes, { typed: character, expected }],
    startedAt: state.startedAt ?? now,
    finishedAt: typed.length === state.target.length ? now : null,
  }
}

export function eraseCharacter(state: TypingState): TypingState {
  if (state.finishedAt !== null || state.typed.length === 0) return state
  return { ...state, typed: state.typed.slice(0, -1) }
}

export function correctCharacters(state: TypingState) {
  let count = 0
  for (let i = 0; i < state.typed.length; i += 1) {
    if (state.typed[i] === state.target[i]) count += 1
  }
  return count
}

/** Words per minute, using the standard five characters to a word. */
export function wordsPerMinute(state: TypingState, now: number) {
  if (state.startedAt === null) return 0
  const minutes = ((state.finishedAt ?? now) - state.startedAt) / 60000
  if (minutes <= 0) return 0
  return Math.round(correctCharacters(state) / 5 / minutes)
}

/** Percentage of keystrokes that were right the first time. */
export function accuracy(state: TypingState) {
  if (state.keystrokes === 0) return 100
  return Math.round(((state.keystrokes - state.mistakes) / state.keystrokes) * 100)
}

/** Touch keyboards don't report physical keys, so characters map back to 3D keys. */
export function codeForCharacter(character: string) {
  if (character === ' ') return 'Space'
  const { config } = useConfig.getState()
  const wanted = character.toLowerCase()
  for (const key of withLegends(layoutOf(config), config.region)) {
    if (key.legend.some((legend) => legend.length === 1 && legend.toLowerCase() === wanted)) {
      return key.code
    }
  }
  return undefined
}

export interface KeyHeat {
  presses: number
  misses: number
}

/**
 * How often each key was pressed in a run, and how often it was the key that should have been
 * pressed when a wrong one was. Keyed by physical key code.
 */
export function keyHeat(state: TypingState): Record<string, KeyHeat> {
  const heat: Record<string, KeyHeat> = {}
  const add = (character: string, field: keyof KeyHeat) => {
    const code = codeForCharacter(character)
    if (!code) return
    heat[code] ??= { presses: 0, misses: 0 }
    heat[code][field] += 1
  }
  for (const stroke of state.strokes) {
    add(stroke.typed, 'presses')
    if (stroke.typed !== stroke.expected) add(stroke.expected, 'misses')
  }
  return heat
}
