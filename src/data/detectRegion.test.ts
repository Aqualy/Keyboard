import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectRegion, regionFromLanguages, regionFromLayoutMap } from './detectRegion'
import { applyDetectedRegion, DEFAULT_CONFIG, useConfig } from '../state/config'

/** What the telling keys type on each system layout, unshifted. */
const LAYOUTS = {
  us: { KeyQ: 'q', KeyY: 'y', Digit6: '6', Equal: '=', Backslash: '\\' },
  uk: { KeyQ: 'q', KeyY: 'y', Digit6: '6', Equal: '=', Backslash: '#' },
  de: { KeyQ: 'q', KeyY: 'z', Digit6: '6', Equal: '´', Backslash: '#' },
  fr: { KeyQ: 'a', KeyY: 'y', Digit6: '-', Equal: '=', Backslash: '*' },
  be: { KeyQ: 'a', KeyY: 'y', Digit6: '§', Equal: '-', Backslash: 'µ' },
}

const mapOf = (keys: Record<string, string>) => new Map(Object.entries(keys))

describe('regionFromLayoutMap', () => {
  it.each(Object.entries(LAYOUTS))('recognises %s', (region, keys) => {
    expect(regionFromLayoutMap(mapOf(keys))).toBe(region)
  })

  it('treats an unknown QWERTY layout as US', () => {
    expect(regionFromLayoutMap(mapOf({ KeyQ: 'q', KeyY: 'y', Backslash: '<' }))).toBe('us')
  })

  it('gives no answer for an empty map', () => {
    expect(regionFromLayoutMap(new Map())).toBeUndefined()
  })
})

describe('regionFromLanguages', () => {
  it.each([
    [['nl-BE'], 'be'],
    [['fr-BE', 'fr'], 'be'],
    [['de-BE'], 'be'],
    [['de-DE'], 'de'],
    [['de-AT'], 'de'],
    [['fr-FR'], 'fr'],
    [['fr'], 'fr'],
    [['en-GB'], 'uk'],
    [['en-IE'], 'uk'],
    [['en-US'], 'us'],
    [['en'], 'us'],
    [['ja-JP', 'en-GB'], 'uk'],
  ])('reads %j as %s', (languages, region) => {
    expect(regionFromLanguages(languages)).toBe(region)
  })

  it('skips French from countries with other layouts', () => {
    expect(regionFromLanguages(['fr-CA'])).toBeUndefined()
    expect(regionFromLanguages(['fr-CH', 'en-US'])).toBe('us')
  })

  it('gives no answer without a known language', () => {
    expect(regionFromLanguages(['ja-JP', 'nl-NL'])).toBeUndefined()
  })
})

describe('detectRegion', () => {
  const browser = (extra: object) =>
    ({
      webdriver: false,
      language: 'en-US',
      languages: ['en-US'],
      ...extra,
    }) as unknown as Navigator

  it('prefers the keyboard over the languages', async () => {
    const keyboard = { getLayoutMap: () => Promise.resolve(mapOf(LAYOUTS.be)) }
    expect(await detectRegion(browser({ keyboard, languages: ['en-GB'] }))).toBe('be')
  })

  it('uses the languages when the browser has no layout map', async () => {
    expect(await detectRegion(browser({ languages: ['de-DE'] }))).toBe('de')
  })

  it('uses the languages when the layout map fails', async () => {
    const keyboard = { getLayoutMap: () => Promise.reject(new Error('blocked')) }
    expect(await detectRegion(browser({ keyboard, languages: ['fr-FR'] }))).toBe('fr')
  })

  it('stops waiting for a layout map that never comes', async () => {
    vi.useFakeTimers()
    const keyboard = { getLayoutMap: () => new Promise(() => {}) }
    const result = detectRegion(browser({ keyboard, languages: ['en-GB'] }))
    await vi.advanceTimersByTimeAsync(300)
    expect(await result).toBe('uk')
    vi.useRealTimers()
  })

  it('leaves automated browsers alone', async () => {
    expect(await detectRegion(browser({ webdriver: true, languages: ['de-DE'] }))).toBeUndefined()
  })
})

describe('applyDetectedRegion', () => {
  afterEach(() => useConfig.setState({ config: DEFAULT_CONFIG }))

  it('switches the board to the region and its standard', () => {
    applyDetectedRegion('be', '')
    expect(useConfig.getState().config).toMatchObject({ region: 'be', standard: 'iso' })
  })

  it('keeps a region or standard the link names', () => {
    applyDetectedRegion('be', '?region=us')
    applyDetectedRegion('be', '?standard=ansi')
    expect(useConfig.getState().config.region).toBe('us')
  })

  it('keeps the board when nothing was detected', () => {
    applyDetectedRegion(undefined, '')
    expect(useConfig.getState().config).toEqual(DEFAULT_CONFIG)
  })
})
