import { create } from 'zustand'
import {
  BRIGHTNESS,
  CASE_COLOURS,
  COLOURWAYS,
  KEYCAP_COLOURS,
  KNOBS,
  LEGEND_COLOURS,
  PLATES,
  PROFILES,
  RGB_COLOURS,
  RGB_EFFECTS,
  SWITCHES,
  type BrightnessId,
  type Colours,
  type ColourwayId,
  type KnobId,
  type PlateId,
  type ProfileId,
  type RgbColourId,
  type RgbEffectId,
  type SwitchId,
} from '../data/options'
import { keyByCode, layoutFor, SIZES, STANDARDS, withLegends, type SizeId } from '../data/layout'
import { defaultRegion, REGIONS, type RegionId, type Standard } from '../data/regions'

export interface Config extends Colours {
  profile: ProfileId
  switch: SwitchId
  plate: PlateId
  knob: KnobId
  rgb: RgbEffectId
  rgbColour: RgbColourId
  brightness: BrightnessId
  size: SizeId
  standard: Standard
  region: RegionId
}

export const DEFAULT_CONFIG: Config = {
  ...COLOURWAYS[0].colours,
  profile: 'cherry',
  switch: 'cream',
  plate: 'pc',
  knob: 'silver',
  // Off, so the starting board is the plain white GMK67.
  rgb: 'off',
  rgbColour: 'cyan',
  brightness: 'medium',
  size: '65',
  standard: 'ansi',
  region: 'us',
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
  rgb: RGB_EFFECTS,
  rgbColour: RGB_COLOURS,
  brightness: BRIGHTNESS,
  size: SIZES,
  standard: STANDARDS,
  region: REGIONS,
}

const FIELDS = Object.keys(CHOICES) as (keyof Config)[]

/** Legends belong to a standard: a region printed for ISO keys can't go on an ANSI board. */
function normalize(config: Config): Config {
  const region = REGIONS.find((candidate) => candidate.id === config.region)
  if (region?.standard === config.standard) return config
  return { ...config, region: defaultRegion(config.standard) }
}

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
  return normalize(config)
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
  update: (patch) =>
    set((state) => {
      const next = { ...state.config, ...patch }
      // Picking a region picks its standard; picking a standard falls back to its first region.
      if (patch.region) {
        next.standard = REGIONS.find((region) => region.id === patch.region)!.standard
      }
      return { config: normalize(next) }
    }),
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

/** The physical layout of a build. */
export const layoutOf = (config: Pick<Config, 'size' | 'standard'>) =>
  layoutFor(config.size, config.standard)

/** The layout being configured right now, for code outside React. */
export const currentLayout = () => layoutOf(useConfig.getState().config)

/** The current layout's key for a physical key code, with the region's legend. */
export function currentKey(code: string) {
  const { config } = useConfig.getState()
  const key = keyByCode(layoutOf(config)).get(code)
  if (!key) return undefined
  return withLegends({ ...layoutOf(config), keys: [key] }, config.region)[0]
}
