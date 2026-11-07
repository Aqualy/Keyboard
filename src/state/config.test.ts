import { beforeEach, describe, expect, it } from 'vitest'
import { COLOURWAYS } from '../data/options'
import {
  DEFAULT_CONFIG,
  matchColourway,
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
}

describe('parseConfig', () => {
  it('returns the default for an empty query', () => {
    expect(parseConfig('')).toEqual(DEFAULT_CONFIG)
  })

  it('starts as a white board', () => {
    expect(matchColourway(DEFAULT_CONFIG)).toBe('white')
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

describe('matchColourway', () => {
  it.each(COLOURWAYS.map((way) => [way.id, way.colours] as const))(
    'recognises %s',
    (id, colours) => {
      expect(matchColourway(colours)).toBe(id)
    },
  )

  it('reports a mixed build as custom', () => {
    expect(matchColourway({ ...COLOURWAYS[0].colours, accent: 'oak' })).toBeUndefined()
  })
})

describe('useConfig', () => {
  beforeEach(() => {
    useConfig.setState({ config: DEFAULT_CONFIG })
  })

  it('applies a colourway without touching hardware', () => {
    useConfig.getState().update({ switch: 'boxnavy' })
    useConfig.getState().applyColourway('beet')
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
