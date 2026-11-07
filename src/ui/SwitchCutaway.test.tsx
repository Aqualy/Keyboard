import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { SWITCHES } from '../data/options'
import { DEFAULT_CONFIG, useConfig } from '../state/config'
import { MECHANISM_TEXT, mechanismOf } from '../data/mechanisms'
import { SwitchCutaway } from './SwitchCutaway'

describe('SwitchCutaway', () => {
  beforeEach(() => {
    useConfig.setState({ config: DEFAULT_CONFIG })
  })

  it('draws the MX design by type, and Topre and buckling spring their own way', () => {
    expect(mechanismOf('cream')).toBe('linear')
    expect(mechanismOf('holypanda')).toBe('tactile')
    expect(mechanismOf('boxnavy')).toBe('clicky')
    expect(mechanismOf('topre')).toBe('dome')
    expect(mechanismOf('buckling')).toBe('buckling')
  })

  it('explains every switch', () => {
    for (const option of SWITCHES) expect(MECHANISM_TEXT[mechanismOf(option.id)]).toBeTruthy()
  })

  it('names the selected switch and how it works', () => {
    useConfig.getState().update({ switch: 'topre' })
    render(<SwitchCutaway className="cutaway-stage" />)
    expect(screen.getByRole('img')).toHaveAccessibleName(/Topre.*rubber dome/)
  })
})
