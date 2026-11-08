import { beforeEach, describe, expect, it } from 'vitest'
import { PRESETS } from '../data/options'
import {
  DEFAULT_CONFIG,
  matchPreset,
  parseConfig,
  serializeConfig,
  useConfig,
  type Config,
} from './config'

const custom: Config = {
  ...DEFAULT_CONFIG,
  case: 'beet',
  accent: 'oak',
  profile: 'sa',
  switch: 'boxnavy',
  plate: 'brass',
  knob: 'black',
  rgb: 'static',
  rgbColour: 'violet',
  brightness: 'high',
}

describe('parseConfig', () => {
  it('returns the default for an empty query', () => {
    expect(parseConfig('')).toEqual(DEFAULT_CONFIG)
  })

  it('starts as a white board', () => {
    expect(matchPreset(DEFAULT_CONFIG)).toBe('white')
  })

  it('round-trips a custom build', () => {
    expect(parseConfig(serializeConfig(custom))).toEqual(custom)
  })

  it.each([
    ['unknown values', 'case=hotpink&profile=dsa'],
    ['empty values', 'case=&switch='],
    ['script injection', 'case=%3Cscript%3Ealert(1)%3C/script%3E'],
    ['malformed encoding', 'case=%E0%A4%A&plate=%'],
    ['prototype keys', '__proto__=x&constructor=y'],
  ])('ignores %s', (_, query) => {
    expect(parseConfig(query)).toEqual(DEFAULT_CONFIG)
  })

  it('keeps valid fields when others are invalid', () => {
    expect(parseConfig('case=sky&profile=nope')).toEqual({ ...DEFAULT_CONFIG, case: 'sky' })
  })

  it('does not accept a colour from another palette', () => {
    expect(parseConfig('legend=beet').legend).toBe(DEFAULT_CONFIG.legend)
    expect(parseConfig('rgbColour=beet').rgbColour).toBe(DEFAULT_CONFIG.rgbColour)
  })

  it('starts as a 65% ANSI board with US legends', () => {
    expect(DEFAULT_CONFIG).toMatchObject({ size: '65', standard: 'ansi', region: 'us' })
  })

  it('reads a layout and keeps its region on the right standard', () => {
    expect(parseConfig('size=tkl&standard=iso&region=be')).toMatchObject({
      size: 'tkl',
      standard: 'iso',
      region: 'be',
    })
    // ISO legends can't go on an ANSI board, so the region falls back.
    expect(parseConfig('standard=ansi&region=de').region).toBe('us')
    expect(parseConfig('standard=iso').region).toBe('uk')
  })

  it('starts with the lights off', () => {
    expect(DEFAULT_CONFIG.rgb).toBe('off')
  })

  it('reads a lighting build', () => {
    expect(parseConfig('rgb=wave&brightness=low')).toMatchObject({ rgb: 'wave', brightness: 'low' })
    expect(parseConfig('rgb=disco').rgb).toBe('off')
  })

  it('uses the last-resort default for repeated params by taking the first', () => {
    expect(parseConfig('case=sky&case=black').case).toBe('sky')
  })
})

describe('serializeConfig', () => {
  it('leaves the default build with a clean URL', () => {
    expect(serializeConfig(DEFAULT_CONFIG)).toBe('')
  })

  it('only writes changed fields', () => {
    expect(serializeConfig({ ...DEFAULT_CONFIG, knob: 'brass' })).toBe('knob=brass')
  })
})

describe('matchPreset', () => {
  beforeEach(() => useConfig.setState({ config: DEFAULT_CONFIG }))

  it.each(PRESETS.map((preset) => preset.id))('recognises %s once applied', (id) => {
    useConfig.getState().applyPreset(id)
    expect(matchPreset(useConfig.getState().config)).toBe(id)
  })

  it('reports a mixed build as custom', () => {
    expect(matchPreset({ ...DEFAULT_CONFIG, accent: 'oak' })).toBeUndefined()
  })

  it('reports a keycap set on another case as custom', () => {
    expect(matchPreset({ ...DEFAULT_CONFIG, keyset: 'neon' })).toBeUndefined()
  })
})

describe('useConfig', () => {
  beforeEach(() => {
    useConfig.setState({ config: DEFAULT_CONFIG })
  })

  it('applies a preset without touching hardware', () => {
    useConfig.getState().update({ switch: 'boxnavy' })
    useConfig.getState().applyPreset('beet')
    const { config } = useConfig.getState()
    expect(config.case).toBe('beet')
    expect(config.switch).toBe('boxnavy')
  })

  it('mirrors the build into the URL', () => {
    useConfig.getState().update({ plate: 'brass' })
    expect(window.location.search).toBe('?plate=brass')
    useConfig.getState().update({ plate: 'pc' })
    expect(window.location.search).toBe('')
  })
})

describe('layout choices', () => {
  beforeEach(() => useConfig.setState({ config: DEFAULT_CONFIG }))

  it('switches the standard when a region from the other one is picked', () => {
    useConfig.getState().update({ region: 'fr' })
    expect(useConfig.getState().config).toMatchObject({ standard: 'iso', region: 'fr' })
  })

  it('falls back to the first region of a newly picked standard', () => {
    useConfig.getState().update({ region: 'de' })
    useConfig.getState().update({ standard: 'ansi' })
    expect(useConfig.getState().config).toMatchObject({ standard: 'ansi', region: 'us' })
  })
})

describe('keycap sets', () => {
  beforeEach(() => useConfig.setState({ config: DEFAULT_CONFIG }))

  it('round-trips a set through the URL', () => {
    const config = { ...DEFAULT_CONFIG, keyset: 'fern' as const }
    expect(serializeConfig(config)).toBe('keyset=fern')
    expect(parseConfig('?keyset=fern')).toEqual(config)
  })

  it('ignores an unknown set', () => {
    expect(parseConfig('?keyset=nope').keyset).toBe('none')
  })

  it('leaves the set when a single keycap or legend colour is picked', () => {
    for (const patch of [
      { alpha: 'grey' },
      { mod: 'sky' },
      { accent: 'oak' },
      { legend: 'rose' },
    ]) {
      useConfig.getState().update({ keyset: 'neon' })
      useConfig.getState().update(patch as Partial<Config>)
      expect(useConfig.getState().config.keyset).toBe('none')
    }
  })

  it('keeps the set through other changes', () => {
    useConfig.getState().update({ keyset: 'lacquer' })
    useConfig.getState().update({ profile: 'sa', case: 'black' })
    expect(useConfig.getState().config.keyset).toBe('lacquer')
  })

  it('puts on a set with its case from a preset, and takes it off for a plain one', () => {
    useConfig.getState().applyPreset('lacquer')
    expect(useConfig.getState().config).toMatchObject({ keyset: 'lacquer', case: 'gold' })
    useConfig.getState().applyPreset('black')
    expect(useConfig.getState().config).toMatchObject({ keyset: 'none', case: 'black' })
  })
})
