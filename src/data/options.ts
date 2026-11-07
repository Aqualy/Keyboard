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

export const SWITCH_TYPES = [
  { id: 'linear', name: 'Linear' },
  { id: 'tactile', name: 'Tactile' },
  { id: 'clicky', name: 'Clicky' },
] as const

export type SwitchTypeId = (typeof SWITCH_TYPES)[number]['id']

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
    travel: 0.4,
    specs: switchSpecs('NovelKeys', 'Smooth', 'Medium'),
  },
  {
    id: 'alpaca',
    name: 'Alpaca',
    type: 'linear',
    stemHex: '#d9a7c7',
    travel: 0.4,
    specs: switchSpecs('Primekb', 'Smooth', 'Medium'),
  },
  {
    id: 'redink',
    name: 'Red Ink',
    type: 'linear',
    stemHex: '#c4342f',
    travel: 0.4,
    specs: switchSpecs('Gateron', 'Smooth', 'Light'),
  },
  {
    id: 'blackink',
    name: 'Black Ink',
    type: 'linear',
    stemHex: '#2a2a2d',
    travel: 0.4,
    specs: switchSpecs('Gateron', 'Smooth', 'Medium'),
  },
  {
    id: 'turquoise',
    name: 'Tealio',
    type: 'linear',
    stemHex: '#2ba8a0',
    travel: 0.36,
    specs: switchSpecs('Zeal PC', 'Smooth', 'Heavy'),
  },
  {
    id: 'mxblack',
    name: 'MX Black',
    type: 'linear',
    stemHex: '#1f1f22',
    travel: 0.4,
    specs: switchSpecs('Cherry', 'Smooth', 'Heavy'),
  },
  {
    id: 'holypanda',
    name: 'Holy Panda',
    type: 'tactile',
    stemHex: '#b9a4dc',
    travel: 0.38,
    specs: switchSpecs('Drop', 'Sharp bump', 'Medium'),
  },
  {
    id: 'mxbrown',
    name: 'MX Brown',
    type: 'tactile',
    stemHex: '#7a4a2b',
    travel: 0.4,
    specs: switchSpecs('Cherry', 'Light bump', 'Light'),
  },
  {
    id: 'topre',
    name: 'Topre',
    type: 'tactile',
    stemHex: '#d8d8d4',
    travel: 0.4,
    specs: switchSpecs('Topre', 'Soft bump', 'Light'),
  },
  {
    id: 'boxnavy',
    name: 'Box Navy',
    type: 'clicky',
    stemHex: '#26406f',
    travel: 0.36,
    specs: switchSpecs('Kailh', 'Bump + click', 'Heavy'),
  },
  {
    id: 'mxblue',
    name: 'MX Blue',
    type: 'clicky',
    stemHex: '#2f62b8',
    travel: 0.4,
    longKeySamples: false,
    specs: switchSpecs('Cherry', 'Bump + click', 'Medium'),
  },
  {
    id: 'bluealps',
    name: 'Blue Alps',
    type: 'clicky',
    stemHex: '#6fa8dc',
    travel: 0.35,
    specs: switchSpecs('SKCM', 'Bump + click', 'Medium'),
  },
  {
    id: 'buckling',
    name: 'Buckling Spring',
    type: 'clicky',
    stemHex: '#3b3b3e',
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
