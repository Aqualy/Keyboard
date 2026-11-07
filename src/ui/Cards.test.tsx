import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, useConfig } from '../state/config'
import { Cards } from './Cards'

const group = (name: string) => screen.getByRole('group', { name })
const config = () => useConfig.getState().config

describe('Cards', () => {
  beforeEach(() => {
    useConfig.setState({ config: DEFAULT_CONFIG })
    render(<Cards />)
  })

  it('reflects the default build', () => {
    expect(within(group('Colourway')).getByRole('radio', { name: 'White' })).toBeChecked()
    expect(within(group('Profile')).getByRole('radio', { name: 'Cherry' })).toBeChecked()
    expect(within(group('Switch')).getByRole('radio', { name: 'Linear' })).toBeChecked()
    expect(within(group('Plate')).getByRole('radio', { name: 'PC' })).toBeChecked()
  })

  it('names every colour swatch for screen readers', () => {
    const names = within(group('Case'))
      .getAllByRole('radio')
      .map((radio) => radio.getAttribute('aria-label'))
    expect(names).toEqual(['White', 'Black', 'Sky', 'Beet'])
  })

  it('applies a colourway to the whole board', async () => {
    await userEvent.click(within(group('Colourway')).getByRole('radio', { name: 'Black' }))
    expect(config()).toMatchObject({ case: 'black', alpha: 'black', legend: 'white' })
  })

  it('shows no preset selected once the build is custom', async () => {
    await userEvent.click(within(group('Case')).getByRole('radio', { name: 'Sky' }))
    for (const radio of within(group('Colourway')).getAllByRole('radio')) {
      expect(radio).not.toBeChecked()
    }
  })

  it('colours only the selected keycap zone', async () => {
    await userEvent.click(within(group('Colour')).getByRole('radio', { name: 'Mods' }))
    await userEvent.click(within(group('Mods colour')).getByRole('radio', { name: 'Oak' }))
    expect(config()).toMatchObject({ mod: 'oak', alpha: 'white', accent: 'white' })
  })

  it('switches to the legend palette for legends', async () => {
    await userEvent.click(within(group('Colour')).getByRole('radio', { name: 'Legends' }))
    await userEvent.click(within(group('Legend colour')).getByRole('radio', { name: 'Rose' }))
    expect(config().legend).toBe('rose')
  })

  it('updates specs with the selected switch', async () => {
    expect(screen.getByText('45 g')).toBeInTheDocument()
    await userEvent.click(within(group('Switch')).getByRole('radio', { name: 'Clicky' }))
    expect(screen.getByText('60 g')).toBeInTheDocument()
    expect(screen.queryByText('45 g')).not.toBeInTheDocument()
  })

  it('updates specs with the selected plate', async () => {
    await userEvent.click(within(group('Plate')).getByRole('radio', { name: 'Brass' }))
    expect(screen.getByText('Ringing')).toBeInTheDocument()
  })

  it('moves through options with the arrow keys', async () => {
    within(group('Knob')).getByRole('radio', { name: 'Silver' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(config().knob).toBe('black')
  })
})
