import { describe, expect, it, vi } from 'vitest'
import { createKeyTracker, shouldPressKey } from './keyInput'

const element = (html: string) => {
  const host = document.createElement('div')
  host.innerHTML = html
  return host.firstElementChild as HTMLElement
}

describe('shouldPressKey', () => {
  const body = document.body

  it('presses known keys', () => {
    expect(shouldPressKey({ code: 'KeyA', repeat: false, target: body })).toBe(true)
  })

  it('ignores auto-repeat', () => {
    expect(shouldPressKey({ code: 'KeyA', repeat: true, target: body })).toBe(false)
  })

  it('ignores keys that are not on this board', () => {
    expect(shouldPressKey({ code: 'F5', repeat: false, target: body })).toBe(false)
  })

  it('leaves navigation keys to a focused control', () => {
    const radio = element('<input type="radio" />')
    expect(shouldPressKey({ code: 'ArrowRight', repeat: false, target: radio })).toBe(false)
    expect(shouldPressKey({ code: 'Space', repeat: false, target: radio })).toBe(false)
    expect(shouldPressKey({ code: 'Tab', repeat: false, target: radio })).toBe(false)
  })

  it('still types letters after a control was clicked', () => {
    const radio = element('<input type="radio" />')
    expect(shouldPressKey({ code: 'KeyQ', repeat: false, target: radio })).toBe(true)
  })

  it('presses every key inside the typing test input', () => {
    const input = element('<input data-typing />')
    expect(shouldPressKey({ code: 'Space', repeat: false, target: input })).toBe(true)
    expect(shouldPressKey({ code: 'Enter', repeat: false, target: input })).toBe(true)
  })
})

describe('createKeyTracker', () => {
  const setup = () => {
    const sink = { press: vi.fn(), release: vi.fn() }
    return { sink, tracker: createKeyTracker(sink) }
  }

  it('presses once however many downs arrive', () => {
    const { sink, tracker } = setup()
    tracker.down('KeyA')
    tracker.down('KeyA')
    expect(sink.press).toHaveBeenCalledTimes(1)
  })

  it('ignores a release without a press', () => {
    const { sink, tracker } = setup()
    tracker.up('KeyA')
    expect(sink.release).not.toHaveBeenCalled()
  })

  it('holds many keys at once', () => {
    const { sink, tracker } = setup()
    for (const code of ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH']) tracker.down(code)
    expect(sink.press).toHaveBeenCalledTimes(6)
  })

  it('releases everything held when focus is lost', () => {
    const { sink, tracker } = setup()
    tracker.down('KeyA')
    tracker.down('KeyB')
    tracker.releaseAll()
    expect(sink.release).toHaveBeenCalledWith('KeyA')
    expect(sink.release).toHaveBeenCalledWith('KeyB')
    tracker.up('KeyA')
    expect(sink.release).toHaveBeenCalledTimes(2)
  })
})
