export interface Swatch {
  id: string
  name: string
  hex: string
}

export interface SpecRow {
  label: string
  value: string
}

export const CASE_COLOURS = [
  { id: 'white', name: 'White', hex: '#ecebe7' },
  { id: 'black', name: 'Black', hex: '#1c1c1e' },
  { id: 'sky', name: 'Sky', hex: '#a8c6e4' },
  { id: 'beet', name: 'Beet', hex: '#4a2b46' },
] as const satisfies readonly Swatch[]

export const KEYCAP_COLOURS = [
  { id: 'white', name: 'White', hex: '#f0efea' },
  { id: 'grey', name: 'Grey', hex: '#b8b8b3' },
  { id: 'black', name: 'Black', hex: '#232325' },
  { id: 'sky', name: 'Sky', hex: '#bcd5ec' },
  { id: 'oak', name: 'Oak', hex: '#d9ae74' },
  { id: 'beet', name: 'Beet', hex: '#571f30' },
  { id: 'plum', name: 'Plum', hex: '#34171f' },
] as const satisfies readonly Swatch[]

export const LEGEND_COLOURS = [
  { id: 'ink', name: 'Ink', hex: '#1b1b1d' },
  { id: 'white', name: 'White', hex: '#f6f6f3' },
  { id: 'rose', name: 'Rose', hex: '#e2485f' },
  { id: 'navy', name: 'Navy', hex: '#27476b' },
] as const satisfies readonly Swatch[]

export type CaseColourId = (typeof CASE_COLOURS)[number]['id']
export type KeycapColourId = (typeof KEYCAP_COLOURS)[number]['id']
export type LegendColourId = (typeof LEGEND_COLOURS)[number]['id']

export interface Colours {
  case: CaseColourId
  alpha: KeycapColourId
  mod: KeycapColourId
  accent: KeycapColourId
  legend: LegendColourId
}

export const COLOURWAYS = [
  {
    id: 'white',
    name: 'White',
    colours: { case: 'white', alpha: 'white', mod: 'white', accent: 'white', legend: 'ink' },
  },
  {
    id: 'black',
    name: 'Black',
    colours: { case: 'black', alpha: 'black', mod: 'black', accent: 'oak', legend: 'white' },
  },
  {
    id: 'sky',
    name: 'Sky',
    colours: { case: 'sky', alpha: 'white', mod: 'sky', accent: 'sky', legend: 'navy' },
  },
  {
    id: 'beet',
    name: 'Beet',
    colours: { case: 'beet', alpha: 'beet', mod: 'plum', accent: 'plum', legend: 'rose' },
  },
] as const satisfies readonly { id: string; name: string; colours: Colours }[]

export const PROFILES = [
  {
    id: 'cherry',
    name: 'Cherry',
    specs: [
      { label: 'Height', value: '8.2-10.2 mm' },
      { label: 'Shape', value: 'Sculpted' },
    ],
  },
  {
    id: 'sa',
    name: 'SA',
    specs: [
      { label: 'Height', value: '12-14.6 mm' },
      { label: 'Shape', value: 'Tall, sculpted' },
    ],
  },
  {
    id: 'xda',
    name: 'XDA',
    specs: [
      { label: 'Height', value: '9.2 mm' },
      { label: 'Shape', value: 'Uniform' },
    ],
  },
] as const satisfies readonly { id: string; name: string; specs: SpecRow[] }[]

/** Keycap plastic. PBT is matte with a fine grain; ABS is smooth and shines. */
export const FINISHES = [
  { id: 'pbt', name: 'PBT', roughness: 0.62, grain: 1 },
  { id: 'abs', name: 'ABS', roughness: 0.2, grain: 0 },
] as const

export type FinishId = (typeof FINISHES)[number]['id']

export const SWITCH_TYPES = [
  { id: 'linear', name: 'Linear' },
  { id: 'tactile', name: 'Tactile' },
  { id: 'clicky', name: 'Clicky' },
] as const

export type SwitchTypeId = (typeof SWITCH_TYPES)[number]['id']

/** Switch designs with their own 3D model. The rest of the switches differ only in colour. */
export const SWITCH_MODELS = ['mx', 'box', 'alps', 'topre', 'buckling'] as const
export type SwitchModel = (typeof SWITCH_MODELS)[number]

export interface SwitchShell {
  hex: string
  /** 1 for solid plastic. Lower lets light through, for clear or smoky polycarbonate. */
  opacity: number
}

const solid = (hex: string): SwitchShell => ({ hex, opacity: 1 })
const CLEAR: SwitchShell = { hex: '#f3f6f9', opacity: 0.1 }
const SMOKY: SwitchShell = { hex: '#55555d', opacity: 0.2 }
const CHERRY_BLACK = solid('#1d1d1f')

const switchSpecs = (maker: string, feel: string, weight: string): SpecRow[] => [
  { label: 'Maker', value: maker },
  { label: 'Feel', value: feel },
  { label: 'Weight', value: weight },
]

interface SwitchOption {
  id: string
  name: string
  type: SwitchTypeId
  stemHex: string
  model: SwitchModel
  top: SwitchShell
  bottom: SwitchShell
  travel: number
  specs: SpecRow[]
  /** False when the recording has no separate Backspace, Enter and Space sounds. */
  longKeySamples?: boolean
}

export const SWITCHES = [
  {
    id: 'cream',
    name: 'Cream',
    type: 'linear',
    stemHex: '#e6dcc3',
    model: 'mx',
    top: solid('#e7dcc1'),
    bottom: solid('#e7dcc1'),
    travel: 0.4,
    specs: switchSpecs('NovelKeys', 'Smooth', 'Medium'),
  },
  {
    id: 'alpaca',
    name: 'Alpaca',
    type: 'linear',
    stemHex: '#d9a7c7',
    model: 'mx',
    top: { hex: '#76777d', opacity: 0.5 },
    bottom: solid('#5d5e63'),
    travel: 0.4,
    specs: switchSpecs('Primekb', 'Smooth', 'Medium'),
  },
  {
    id: 'redink',
    name: 'Red Ink',
    type: 'linear',
    stemHex: '#c4342f',
    model: 'mx',
    top: SMOKY,
    bottom: SMOKY,
    travel: 0.4,
    specs: switchSpecs('Gateron', 'Smooth', 'Light'),
  },
  {
    id: 'blackink',
    name: 'Black Ink',
    type: 'linear',
    stemHex: '#2a2a2d',
    model: 'mx',
    top: SMOKY,
    bottom: SMOKY,
    travel: 0.4,
    specs: switchSpecs('Gateron', 'Smooth', 'Medium'),
  },
  {
    id: 'turquoise',
    name: 'Tealio',
    type: 'linear',
    stemHex: '#2ba8a0',
    model: 'mx',
    top: CLEAR,
    bottom: CLEAR,
    travel: 0.36,
    specs: switchSpecs('Zeal PC', 'Smooth', 'Heavy'),
  },
  {
    id: 'mxblack',
    name: 'MX Black',
    type: 'linear',
    stemHex: '#1f1f22',
    model: 'mx',
    top: CHERRY_BLACK,
    bottom: CHERRY_BLACK,
    travel: 0.4,
    specs: switchSpecs('Cherry', 'Smooth', 'Heavy'),
  },
  {
    id: 'holypanda',
    name: 'Holy Panda',
    type: 'tactile',
    stemHex: '#e8a184',
    model: 'mx',
    top: solid('#ece5d8'),
    bottom: solid('#ece5d8'),
    travel: 0.38,
    specs: switchSpecs('Drop', 'Sharp bump', 'Medium'),
  },
  {
    id: 'mxbrown',
    name: 'MX Brown',
    type: 'tactile',
    stemHex: '#7a4a2b',
    model: 'mx',
    top: CHERRY_BLACK,
    bottom: CHERRY_BLACK,
    travel: 0.4,
    specs: switchSpecs('Cherry', 'Light bump', 'Light'),
  },
  {
    id: 'topre',
    name: 'Topre',
    type: 'tactile',
    stemHex: '#d8d8d4',
    model: 'topre',
    top: solid('#2a2a2c'),
    bottom: solid('#2a2a2c'),
    travel: 0.4,
    specs: switchSpecs('Topre', 'Soft bump', 'Light'),
  },
  {
    id: 'boxnavy',
    name: 'Box Navy',
    type: 'clicky',
    stemHex: '#26406f',
    model: 'box',
    top: CLEAR,
    bottom: solid('#f1f0ec'),
    travel: 0.36,
    specs: switchSpecs('Kailh', 'Bump + click', 'Heavy'),
  },
  {
    id: 'mxblue',
    name: 'MX Blue',
    type: 'clicky',
    stemHex: '#2f62b8',
    model: 'mx',
    top: CHERRY_BLACK,
    bottom: CHERRY_BLACK,
    travel: 0.4,
    longKeySamples: false,
    specs: switchSpecs('Cherry', 'Bump + click', 'Medium'),
  },
  {
    id: 'bluealps',
    name: 'Blue Alps',
    type: 'clicky',
    stemHex: '#7e94ad',
    model: 'alps',
    top: solid('#2f2f32'),
    bottom: solid('#2f2f32'),
    travel: 0.35,
    specs: switchSpecs('SKCM', 'Bump + click', 'Medium'),
  },
  {
    id: 'buckling',
    name: 'Buckling Spring',
    type: 'clicky',
    stemHex: '#a9abae',
    model: 'buckling',
    top: solid('#3a3a3d'),
    bottom: solid('#1c1c1e'),
    travel: 0.38,
    specs: switchSpecs('IBM Model M', 'Bump + click', 'Heavy'),
  },
] as const satisfies readonly SwitchOption[]

export const PLATES = [
  {
    id: 'pc',
    name: 'PC',
    hex: '#d7dee1',
    metalness: 0,
    roughness: 0.48,
    specs: [
      { label: 'Flex', value: 'High' },
      { label: 'Tone', value: 'Deep' },
    ],
  },
  {
    id: 'fr4',
    name: 'FR4',
    hex: '#26282a',
    metalness: 0,
    roughness: 0.6,
    specs: [
      { label: 'Flex', value: 'Medium' },
      { label: 'Tone', value: 'Balanced' },
    ],
  },
  {
    id: 'aluminium',
    name: 'Aluminium',
    hex: '#c9cbcd',
    metalness: 1,
    roughness: 0.42,
    specs: [
      { label: 'Flex', value: 'Low' },
      { label: 'Tone', value: 'Bright' },
    ],
  },
  {
    id: 'brass',
    name: 'Brass',
    hex: '#c9a35a',
    metalness: 1,
    roughness: 0.34,
    specs: [
      { label: 'Flex', value: 'Very low' },
      { label: 'Tone', value: 'Ringing' },
    ],
  },
] as const satisfies readonly {
  id: string
  name: string
  hex: string
  metalness: number
  roughness: number
  specs: SpecRow[]
}[]

export const KNOBS = [
  { id: 'silver', name: 'Silver', hex: '#d8d8d6', metalness: 1, roughness: 0.34 },
  { id: 'black', name: 'Black', hex: '#232325', metalness: 1, roughness: 0.42 },
  { id: 'brass', name: 'Brass', hex: '#c9a35a', metalness: 1, roughness: 0.3 },
] as const satisfies readonly {
  id: string
  name: string
  hex: string
  metalness: number
  roughness: number
}[]

/** Cable colours match the case palette, so a cable can match the board or contrast it. */
export const CABLES = [
  { id: 'none', name: 'None', hex: '#000000' },
  { id: 'white', name: 'White', hex: '#ecebe7' },
  { id: 'black', name: 'Black', hex: '#1c1c1e' },
  { id: 'sky', name: 'Sky', hex: '#a8c6e4' },
  { id: 'beet', name: 'Beet', hex: '#4a2b46' },
] as const

export const DESK_MATS = [
  { id: 'none', name: 'None', hex: '#000000' },
  { id: 'grey', name: 'Grey', hex: '#8e9093' },
  { id: 'black', name: 'Black', hex: '#232326' },
  { id: 'sky', name: 'Sky', hex: '#9fbcd8' },
  { id: 'beet', name: 'Beet', hex: '#4a2b46' },
] as const

export type CableId = (typeof CABLES)[number]['id']
export type DeskMatId = (typeof DESK_MATS)[number]['id']

/** Lighting effects. The shader reads the index, so keep the order in sync with materials.ts. */
export const RGB_EFFECTS = [
  { id: 'off', name: 'Off' },
  { id: 'static', name: 'Static' },
  { id: 'spectrum', name: 'Spectrum' },
  { id: 'wave', name: 'Wave' },
  { id: 'ripple', name: 'Ripple' },
  // Dark until a key is pressed, then that key lights and a ring spreads from it.
  { id: 'reactive', name: 'Reactive' },
] as const

export const RGB_COLOURS = [
  { id: 'white', name: 'White', hex: '#fff4e6' },
  { id: 'red', name: 'Red', hex: '#ff2236' },
  { id: 'green', name: 'Green', hex: '#2bff6a' },
  { id: 'cyan', name: 'Cyan', hex: '#1fe4ff' },
  { id: 'blue', name: 'Blue', hex: '#2a52ff' },
  { id: 'violet', name: 'Violet', hex: '#9a3cff' },
  { id: 'pink', name: 'Pink', hex: '#ff3fb4' },
] as const satisfies readonly Swatch[]

export const BRIGHTNESS = [
  { id: 'low', name: 'Low', intensity: 0.9 },
  { id: 'medium', name: 'Medium', intensity: 1.8 },
  { id: 'high', name: 'High', intensity: 3 },
] as const

export type RgbEffectId = (typeof RGB_EFFECTS)[number]['id']
export type RgbColourId = (typeof RGB_COLOURS)[number]['id']
/** Effects drawn in one chosen colour. The others run through the spectrum. */
export const hasLightColour = (effect: RgbEffectId) => effect === 'static' || effect === 'reactive'

export type BrightnessId = (typeof BRIGHTNESS)[number]['id']

export type ColourwayId = (typeof COLOURWAYS)[number]['id']
export type ProfileId = (typeof PROFILES)[number]['id']
export type SwitchId = (typeof SWITCHES)[number]['id']
export type PlateId = (typeof PLATES)[number]['id']
export type KnobId = (typeof KNOBS)[number]['id']

/** Whether a switch has its own Backspace, Enter and Space recordings. */
export function hasLongKeySamples(id: SwitchId) {
  const option = SWITCHES.find((candidate) => candidate.id === id)
  return !(option && 'longKeySamples' in option) || option.longKeySamples
}

export const byId = <T extends { id: string }>(list: readonly T[], id: string): T => {
  const found = list.find((item) => item.id === id)
  if (!found) throw new Error(`Unknown option: ${id}`)
  return found
}
