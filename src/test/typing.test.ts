import { describe, expect, it } from 'vitest'
import {
  accuracy,
  codeForCharacter,
  correctCharacters,
  eraseCharacter,
  PHRASES,
  startTyping,
  typeCharacter,
  wordsPerMinute,
  type TypingState,
} from './typing'

const typeAll = (state: TypingState, text: string, start = 0, step = 100) =>
  [...text].reduce((next, char, index) => typeCharacter(next, char, start + index * step), state)

describe('typing test', () => {
  it('starts the timer on the first keystroke, not on load', () => {
    const state = startTyping('ab')
    expect(state.startedAt).toBeNull()
    expect(typeCharacter(state, 'a', 500).startedAt).toBe(500)
  })

  it('finishes on the last character and ignores anything after', () => {
    const done = typeAll(startTyping('ab'), 'ab')
    expect(done.finishedAt).toBe(100)
    expect(typeCharacter(done, 'c', 900)).toBe(done)
  })

  it('finishes even when the last character is wrong', () => {
    expect(typeAll(startTyping('ab'), 'ax').finishedAt).not.toBeNull()
  })

  it('reports perfect typing as 100%', () => {
    expect(accuracy(typeAll(startTyping('abc'), 'abc'))).toBe(100)
  })

  it('reports all-wrong typing as 0%, with 0 WPM', () => {
    const state = typeAll(startTyping('abc'), 'xyz')
    expect(accuracy(state)).toBe(0)
    expect(wordsPerMinute(state, 1000)).toBe(0)
  })

  it('reports no input without dividing by zero', () => {
    const state = startTyping('abc')
    expect(accuracy(state)).toBe(100)
    expect(wordsPerMinute(state, 1000)).toBe(0)
  })

  it('handles a test finished in a single instant', () => {
    expect(wordsPerMinute(typeCharacter(startTyping('a'), 'a', 100), 100)).toBe(0)
  })

  it('calculates WPM from correct characters over elapsed time', () => {
    const start = typeCharacter(startTyping('abcde x'), 'a', 0)
    const state = { ...start, typed: 'abcde', startedAt: 0 }
    expect(wordsPerMinute(state, 60000)).toBe(1)
  })

  it('keeps counting a corrected mistake against accuracy', () => {
    let state = typeCharacter(startTyping('ab'), 'x', 0)
    state = eraseCharacter(state)
    state = typeAll(state, 'ab', 100)
    expect(state.typed).toBe('ab')
    expect(correctCharacters(state)).toBe(2)
    expect(accuracy(state)).toBe(67)
  })

  it('ignores backspace at the start and after finishing', () => {
    const empty = startTyping('ab')
    expect(eraseCharacter(empty)).toBe(empty)
    const done = typeAll(startTyping('a'), 'a')
    expect(eraseCharacter(done)).toBe(done)
  })
})

describe('codeForCharacter', () => {
  it.each([
    ['a', 'KeyA'],
    ['A', 'KeyA'],
    ['1', 'Digit1'],
    ['!', 'Digit1'],
    [' ', 'Space'],
    [';', 'Semicolon'],
    ['?', 'Slash'],
  ])('maps %j to %s', (character, code) => {
    expect(codeForCharacter(character)).toBe(code)
  })

  it('has nothing for characters off the keyboard', () => {
    expect(codeForCharacter('é')).toBeUndefined()
  })

  it('can type every phrase', () => {
    for (const phrase of PHRASES) {
      for (const character of phrase) expect(codeForCharacter(character)).toBeDefined()
    }
  })
})
