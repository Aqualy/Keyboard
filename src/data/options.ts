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

export const SWITCHES = [
  {
    id: 'linear',
    name: 'Linear',
    stemHex: '#c4342f',
    travel: 0.4,
    specs: [
      { label: 'Actuation', value: '45 g' },
      { label: 'Feel', value: 'Smooth' },
      { label: 'Sound', value: 'Soft' },
    ],
  },
  {
    id: 'tactile',
    name: 'Tactile',
    stemHex: '#8a5a33',
    travel: 0.38,
    specs: [
      { label: 'Actuation', value: '55 g' },
      { label: 'Feel', value: 'Bump' },
      { label: 'Sound', value: 'Medium' },
    ],
  },
  {
    id: 'clicky',
    name: 'Clicky',
    stemHex: '#2f62b8',
    travel: 0.36,
    specs: [
      { label: 'Actuation', value: '60 g' },
      { label: 'Feel', value: 'Bump + click' },
      { label: 'Sound', value: 'Loud' },
    ],
  },
] as const satisfies readonly {
  id: string
  name: string
  stemHex: string
  travel: number
  specs: SpecRow[]
}[]

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

export const byId = <T extends { id: string }>(list: readonly T[], id: string): T => {
  const found = list.find((item) => item.id === id)
  if (!found) throw new Error(`Unknown option: ${id}`)
  return found
}
