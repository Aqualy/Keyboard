import { create } from 'zustand'
import {
  CASE_COLOURS,
  COLOURWAYS,
  KEYCAP_COLOURS,
  KNOBS,
  LEGEND_COLOURS,
  PLATES,
  PROFILES,
  SWITCHES,
  type Colours,
  type ColourwayId,
  type KnobId,
  type PlateId,
  type ProfileId,
  type SwitchId,
} from '../data/options'

export interface Config extends Colours {
  profile: ProfileId
  switch: SwitchId
  plate: PlateId
  knob: KnobId
}

export const DEFAULT_CONFIG: Config = {
  ...COLOURWAYS[0].colours,
  profile: 'cherry',
  switch: 'linear',
  plate: 'pc',
  knob: 'silver',
}

const CHOICES: Record<keyof Config, readonly { id: string }[]> = {
  case: CASE_COLOURS,
  alpha: KEYCAP_COLOURS,
  mod: KEYCAP_COLOURS,
  accent: KEYCAP_COLOURS,
  legend: LEGEND_COLOURS,
  profile: PROFILES,
  switch: SWITCHES,
  plate: PLATES,
  knob: KNOBS,
}

const FIELDS = Object.keys(CHOICES) as (keyof Config)[]

/** Reads a build from a query string. Anything unrecognised falls back to the default. */
export function parseConfig(search: string): Config {
  const params = new URLSearchParams(search)
  const config = { ...DEFAULT_CONFIG }
  for (const field of FIELDS) {
    const value = params.get(field)
    if (value && CHOICES[field].some((choice) => choice.id === value)) {
      ;(config[field] as string) = value
    }
  }
  return config
}

/** Writes only what differs from the default, so an unchanged build has a clean URL. */
export function serializeConfig(config: Config): string {
  const params = new URLSearchParams()
  for (const field of FIELDS) {
    if (config[field] !== DEFAULT_CONFIG[field]) params.set(field, config[field])
  }
  return params.toString()
}

/** The preset a build matches exactly, or undefined for a custom mix. */
export function matchColourway(config: Colours): ColourwayId | undefined {
  return COLOURWAYS.find((way) =>
    (Object.keys(way.colours) as (keyof Colours)[]).every(
      (zone) => way.colours[zone] === config[zone],
    ),
  )?.id
}

interface ConfigStore {
  config: Config
  update: (patch: Partial<Config>) => void
  applyColourway: (id: ColourwayId) => void
}

export const useConfig = create<ConfigStore>((set) => ({
  config: parseConfig(window.location.search),
  update: (patch) => set((state) => ({ config: { ...state.config, ...patch } })),
  applyColourway: (id) =>
    set((state) => {
      const way = COLOURWAYS.find((candidate) => candidate.id === id)
      return way ? { config: { ...state.config, ...way.colours } } : state
    }),
}))

useConfig.subscribe(({ config }) => {
  const query = serializeConfig(config)
  const url = `${window.location.pathname}${query ? `?${query}` : ''}`
  window.history.replaceState(null, '', url)
})
