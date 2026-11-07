import { KEYS } from '../data/layout'

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
  startedAt: number | null
  finishedAt: number | null
}

export const startTyping = (target: string): TypingState => ({
  target,
  typed: '',
  keystrokes: 0,
  mistakes: 0,
  startedAt: null,
  finishedAt: null,
})

export function typeCharacter(state: TypingState, character: string, now: number): TypingState {
  if (state.finishedAt !== null || state.typed.length >= state.target.length) return state
  const typed = state.typed + character
  const correct = state.target[state.typed.length] === character
  return {
    ...state,
    typed,
    keystrokes: state.keystrokes + 1,
    mistakes: state.mistakes + (correct ? 0 : 1),
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

const CHARACTER_TO_CODE = new Map<string, string>()
for (const key of KEYS) {
  for (const legend of key.legend) {
    if (legend.length === 1) CHARACTER_TO_CODE.set(legend.toLowerCase(), key.code)
  }
}
CHARACTER_TO_CODE.set(' ', 'Space')

/** Touch keyboards don't report physical keys, so characters map back to 3D keys. */
export const codeForCharacter = (character: string) =>
  CHARACTER_TO_CODE.get(character.toLowerCase())
