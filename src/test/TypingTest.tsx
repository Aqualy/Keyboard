import { useEffect, useRef, useState, type FormEvent } from 'react'
import { announceSoftKey, KEY_TAP_EVENT } from '../scene/keyTap'
import { currentKey } from '../state/config'
import { useStage } from '../state/stage'
import {
  accuracy,
  eraseCharacter,
  PHRASES,
  startTyping,
  typeCharacter,
  wordsPerMinute,
  type TypingState,
} from './typing'

const pickPhrase = (previous?: string) => {
  const choices = PHRASES.filter((phrase) => phrase !== previous)
  return choices[Math.floor(Math.random() * choices.length)]
}

function characterForCode(code: string) {
  if (code === 'Space') return ' '
  // The printed legend, so tapping a key types what the chosen region shows on it.
  const legend = currentKey(code)?.legend.at(-1)
  return legend?.length === 1 ? legend.toLowerCase() : undefined
}

function Phrase({ state }: { state: TypingState }) {
  return (
    <p className="phrase" aria-label={state.target}>
      {[...state.target].map((character, index) => {
        const typed = state.typed[index]
        const status =
          typed === undefined
            ? index === state.typed.length
              ? 'next'
              : ''
            : typed === character
              ? 'hit'
              : 'miss'
        return (
          <span key={index} data-status={status} aria-hidden="true">
            {character}
          </span>
        )
      })}
    </p>
  )
}

export function TypingTest() {
  const setMode = useStage((state) => state.setMode)
  const [run, setRun] = useState(() => startTyping(pickPhrase()))
  const inputRef = useRef<HTMLInputElement>(null)
  // Android reports no physical key, so only then do characters press 3D keys.
  const lastKeydownUnidentified = useRef(true)
  const finished = run.finishedAt !== null

  const focusInput = () => inputRef.current?.focus()
  useEffect(focusInput, [finished])

  const exit = () => setMode('configure')
  const retry = () => setRun(startTyping(pickPhrase(run.target)))

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMode('configure')
    }
    const onTap = (event: Event) => {
      const code = (event as CustomEvent<string>).detail
      if (code === 'Backspace') {
        setRun((state) => eraseCharacter(state))
        return
      }
      const character = characterForCode(code)
      if (character) setRun((state) => typeCharacter(state, character, performance.now()))
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener(KEY_TAP_EVENT, onTap)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(KEY_TAP_EVENT, onTap)
    }
  }, [setMode])

  // A hidden input receives text, which also makes phone keyboards work.
  const onInput = (event: FormEvent<HTMLInputElement>) => {
    const native = event.nativeEvent as InputEvent
    const { value } = event.currentTarget
    event.currentTarget.value = ''
    if (native.inputType === 'deleteContentBackward') {
      setRun((state) => eraseCharacter(state))
      return
    }
    for (const character of value) {
      if (lastKeydownUnidentified.current) announceSoftKey(character)
      setRun((state) => typeCharacter(state, character, performance.now()))
    }
  }

  return (
    <div className="typing" onPointerUp={focusInput}>
      <input
        ref={inputRef}
        data-typing
        className="typing-input"
        aria-label="Type the phrase"
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        onKeyDown={(event) => {
          lastKeydownUnidentified.current = event.code === '' || event.key === 'Unidentified'
          if (event.key === 'Backspace' && event.currentTarget.value === '') {
            setRun((state) => eraseCharacter(state))
          }
        }}
        onInput={onInput}
        disabled={finished}
      />
      {finished ? (
        <div className="results">
          <dl className="result-stats">
            <div>
              <dt>WPM</dt>
              <dd>{wordsPerMinute(run, run.finishedAt ?? 0)}</dd>
            </div>
            <div>
              <dt>Accuracy</dt>
              <dd>{accuracy(run)}%</dd>
            </div>
          </dl>
          <div className="result-actions">
            <button type="button" className="secondary" onClick={exit}>
              Back to configurator
            </button>
            <button type="button" className="primary" onClick={retry} autoFocus>
              Retry
            </button>
          </div>
        </div>
      ) : (
        <>
          <Phrase state={run} />
          <button type="button" className="exit" onClick={exit}>
            Exit
          </button>
        </>
      )}
    </div>
  )
}
