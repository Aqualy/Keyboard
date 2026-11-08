import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { CASE_COLOURS, SWITCHES, SWITCH_TYPES } from '../data/options'
import { DEFAULT_CONFIG, useConfig } from '../state/config'
import { useStage } from '../state/stage'
import { Folders } from './Folders'

const group = (name: string) => screen.getByRole('group', { name })
const tab = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name} `) })
const open = (name: string) => userEvent.click(tab(name))
const config = () => useConfig.getState().config

describe('Folders', () => {
  beforeEach(() => {
    useConfig.setState({ config: DEFAULT_CONFIG })
    useStage.setState({ section: 'style', compare: null })
    render(<Folders />)
  })

  it('starts with only the style folder open', () => {
    expect(tab('Style')).toHaveAttribute('aria-expanded', 'true')
    for (const name of ['Layout', 'Switches', 'Plate', 'Lighting', 'Desk']) {
      expect(tab(name)).toHaveAttribute('aria-expanded', 'false')
    }
    expect(screen.queryByRole('group', { name: 'Switch' })).not.toBeInTheDocument()
  })

  it('opens one folder at a time and remembers it for the 3D fade', async () => {
    await open('Switches')
    expect(tab('Switches')).toHaveAttribute('aria-expanded', 'true')
    expect(tab('Style')).toHaveAttribute('aria-expanded', 'false')
    expect(group('Switch')).toBeVisible()
    expect(screen.queryByRole('group', { name: 'Preset' })).not.toBeInTheDocument()
    expect(useStage.getState().section).toBe('switches')
  })

  it('shows each current choice on its tab', () => {
    expect(tab('Style')).toHaveTextContent('White')
    expect(tab('Switches')).toHaveTextContent('Cream')
    expect(tab('Plate')).toHaveTextContent('PC')
  })

  it('reflects the default build', async () => {
    expect(within(group('Preset')).getByRole('radio', { name: 'White' })).toBeChecked()
    expect(within(group('Profile')).getByRole('radio', { name: 'Cherry' })).toBeChecked()
    await open('Switches')
    expect(within(group('Switch')).getByRole('radio', { name: 'Cream' })).toBeChecked()
    await open('Plate')
    expect(within(group('Plate')).getByRole('radio', { name: 'PC' })).toBeChecked()
  })

  it('names every colour swatch for screen readers', () => {
    const names = within(group('Case colour'))
      .getAllByRole('radio')
      .map((radio) => radio.getAttribute('aria-label'))
    expect(names).toEqual(CASE_COLOURS.map((colour) => colour.name))
    expect(names.every(Boolean)).toBe(true)
  })

  it('applies a preset to the whole board', async () => {
    await userEvent.click(within(group('Preset')).getByRole('radio', { name: 'Black' }))
    expect(config()).toMatchObject({ case: 'black', alpha: 'black', legend: 'white' })
  })

  it('shows no preset selected once the build is custom', async () => {
    await userEvent.click(within(group('Case colour')).getByRole('radio', { name: 'Sky' }))
    for (const radio of within(group('Preset')).getAllByRole('radio')) {
      expect(radio).not.toBeChecked()
    }
  })

  it('colours only the selected keycap zone', async () => {
    await userEvent.click(within(group('Colour')).getByRole('radio', { name: 'Mods' }))
    await userEvent.click(within(group('Mods colour')).getByRole('radio', { name: 'Oak' }))
    expect(config()).toMatchObject({ mod: 'oak', alpha: 'white', accent: 'white' })
  })

  it('offers matte PBT or shiny ABS keycaps', async () => {
    expect(within(group('Material')).getByRole('radio', { name: 'PBT' })).toBeChecked()
    await userEvent.click(within(group('Material')).getByRole('radio', { name: 'ABS' }))
    expect(config().finish).toBe('abs')
  })

  it('switches to the legend palette for legends', async () => {
    await userEvent.click(within(group('Colour')).getByRole('radio', { name: 'Legends' }))
    await userEvent.click(within(group('Legend colour')).getByRole('radio', { name: 'Rose' }))
    expect(config().legend).toBe('rose')
  })

  it('updates specs with the selected switch', async () => {
    await open('Switches')
    expect(screen.getByText('NovelKeys')).toBeInTheDocument()
    await userEvent.click(within(group('Switch')).getByRole('radio', { name: 'Red Ink' }))
    expect(screen.getByText('Gateron')).toBeInTheDocument()
    expect(screen.queryByText('NovelKeys')).not.toBeInTheDocument()
  })

  it('offers every switch under its type', async () => {
    await open('Switches')
    const seen: string[] = []
    for (const type of SWITCH_TYPES) {
      await userEvent.click(within(group('Type')).getByRole('radio', { name: type.name }))
      const names = within(group('Switch'))
        .getAllByRole('radio')
        .map((radio) => (radio.closest('label') as HTMLElement).textContent)
      expect(names.length).toBeGreaterThan(0)
      seen.push(...(names as string[]))
    }
    expect(seen.sort()).toEqual(SWITCHES.map((option) => option.name).sort())
  })

  it('holds one switch on the left half to compare with the next', async () => {
    await open('Switches')
    await userEvent.click(screen.getByRole('button', { name: 'Compare switches' }))
    expect(useStage.getState().compare).toBe('cream')
    await userEvent.click(
      within(group('Right half · left is Cream')).getByRole('radio', { name: 'Red Ink' }),
    )
    expect(tab('Switches')).toHaveTextContent('Cream vs Red Ink')
    await userEvent.click(screen.getByRole('button', { name: 'Stop comparing' }))
    expect(useStage.getState().compare).toBeNull()
    expect(config().switch).toBe('redink')
  })

  it('selects the first switch of a new type', async () => {
    await open('Switches')
    await userEvent.click(within(group('Type')).getByRole('radio', { name: 'Clicky' }))
    expect(config().switch).toBe('boxnavy')
    expect(within(group('Switch')).getByRole('radio', { name: 'Box Navy' })).toBeChecked()
  })

  it('updates specs with the selected plate', async () => {
    await open('Plate')
    await userEvent.click(within(group('Plate')).getByRole('radio', { name: 'Brass' }))
    expect(screen.getByText('Ringing')).toBeInTheDocument()
    expect(tab('Plate')).toHaveTextContent('Brass')
  })

  it('moves through options with the arrow keys', async () => {
    within(group('Knob')).getByRole('radio', { name: 'Silver' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(config().knob).toBe('black')
  })

  it('only offers a light colour for the static effect, and brightness once lit', async () => {
    await open('Lighting')
    expect(screen.queryByRole('group', { name: 'Brightness' })).not.toBeInTheDocument()
    await userEvent.click(within(group('Effect')).getByRole('radio', { name: 'Wave' }))
    expect(group('Brightness')).toBeVisible()
    expect(screen.queryByRole('group', { name: 'Light colour' })).not.toBeInTheDocument()
    await userEvent.click(within(group('Effect')).getByRole('radio', { name: 'Static' }))
    await userEvent.click(within(group('Light colour')).getByRole('radio', { name: 'Red' }))
    expect(config()).toMatchObject({ rgb: 'static', rgbColour: 'red' })
    expect(tab('Lighting')).toHaveTextContent('Static')
  })

  it('offers a light colour for the reactive effect', async () => {
    await open('Lighting')
    await userEvent.click(within(group('Effect')).getByRole('radio', { name: 'Reactive' }))
    await userEvent.click(within(group('Light colour')).getByRole('radio', { name: 'Pink' }))
    expect(config()).toMatchObject({ rgb: 'reactive', rgbColour: 'pink' })
  })

  it('adds a cable and a desk mat, and names them on the tab', async () => {
    expect(tab('Desk')).toHaveTextContent('None')
    await open('Desk')
    await userEvent.click(within(group('Coiled cable')).getByRole('radio', { name: 'Sky' }))
    expect(tab('Desk')).toHaveTextContent('Cable')
    await userEvent.click(within(group('Desk mat')).getByRole('radio', { name: 'Grey' }))
    expect(config()).toMatchObject({ cable: 'sky', mat: 'grey' })
    expect(tab('Desk')).toHaveTextContent('Cable + Mat')
  })

  it('offers the legends that fit the chosen standard', async () => {
    await open('Layout')
    const regions = () =>
      within(group('Legends'))
        .getAllByRole('radio')
        .map((radio) => (radio.closest('label') as HTMLElement).textContent)
    expect(regions()).toEqual(['US'])
    await userEvent.click(within(group('Standard')).getByRole('radio', { name: 'ISO' }))
    expect(regions()).toEqual(['UK', 'DE', 'FR', 'BE'])
    await userEvent.click(within(group('Legends')).getByRole('radio', { name: 'BE' }))
    await userEvent.click(within(group('Size')).getByRole('radio', { name: 'TKL' }))
    expect(config()).toMatchObject({ size: 'tkl', standard: 'iso', region: 'be' })
    expect(tab('Layout')).toHaveTextContent('TKL BE')
  })
})
