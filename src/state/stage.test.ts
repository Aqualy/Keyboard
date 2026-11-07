import { beforeEach, describe, expect, it } from 'vitest'
import { stepVolume, switchForKey, useStage } from './stage'

describe('knob volume', () => {
  beforeEach(() => {
    useStage.setState({ volume: 0.8, soundOn: true, volumeLabel: null })
  })

  it('moves in even steps and stays between silent and full', () => {
    expect(stepVolume(0.8, 1)).toBe(0.85)
    expect(stepVolume(0.8, -3)).toBe(0.65)
    expect(stepVolume(0.95, 4)).toBe(1)
    expect(stepVolume(0.05, -4)).toBe(0)
  })

  it('shows the volume where the knob is turned', () => {
    useStage.getState().turnVolume(-1, { x: 10, y: 20 })
    expect(useStage.getState()).toMatchObject({ volume: 0.75, volumeLabel: { x: 10, y: 20 } })
    useStage.getState().hideVolume()
    expect(useStage.getState().volumeLabel).toBeNull()
  })

  it('unmutes when turned up, but not when turned down', () => {
    useStage.setState({ soundOn: false })
    useStage.getState().turnVolume(-1, { x: 0, y: 0 })
    expect(useStage.getState().soundOn).toBe(false)
    useStage.getState().turnVolume(1, { x: 0, y: 0 })
    expect(useStage.getState().soundOn).toBe(true)
  })
})

describe('switch comparison', () => {
  it('plays the compared switch on the left half only', () => {
    expect(switchForKey(-3, 'redink', 'cream')).toBe('cream')
    expect(switchForKey(3, 'redink', 'cream')).toBe('redink')
    expect(switchForKey(-3, 'redink', null)).toBe('redink')
  })
})
