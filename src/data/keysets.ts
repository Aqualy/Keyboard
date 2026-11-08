/**
 * Keycap sets: whole colour schemes for caps and legends, each with its own legend colour per
 * zone. They follow the colour balance of popular doubleshot sets (a light or dark base, a
 * contrasting modifier colour, one bright accent) under their own names. Sets with symbols print
 * the standard keyboard symbols on the big modifiers instead of words.
 */
export interface KeysetColours {
  alpha: string
  mod: string
  accent: string
}

export const KEYSETS = [
  { id: 'none', name: 'None' },
  {
    id: 'blush',
    name: 'Blush',
    caps: { alpha: '#ebe4db', mod: '#2b2a2d', accent: '#e8aaa8' },
    legends: { alpha: '#2b2a2d', mod: '#e8aaa8', accent: '#2b2a2d' },
    symbols: true,
  },
  {
    id: 'fern',
    name: 'Fern',
    caps: { alpha: '#e9e6da', mod: '#3f5f4b', accent: '#93ae8f' },
    legends: { alpha: '#2e4a39', mod: '#e9e6da', accent: '#24382c' },
    symbols: true,
  },
  {
    id: 'neon',
    name: 'Neon',
    caps: { alpha: '#30245a', mod: '#1a1734', accent: '#e0377f' },
    legends: { alpha: '#ec4d93', mod: '#35cbd8', accent: '#1a1734' },
    symbols: false,
  },
  {
    id: 'lacquer',
    name: 'Lacquer',
    caps: { alpha: '#9c2027', mod: '#2a2829', accent: '#c9a35b' },
    legends: { alpha: '#dcb76a', mod: '#dcb76a', accent: '#2a2829' },
    symbols: false,
  },
  {
    id: 'static',
    name: 'Static',
    caps: { alpha: '#a4a7ac', mod: '#3a3c41', accent: '#efa4b6' },
    legends: { alpha: '#26272b', mod: '#efa4b6', accent: '#26272b' },
    symbols: true,
  },
] as const satisfies readonly (
  | { id: 'none'; name: string }
  | {
      id: string
      name: string
      caps: KeysetColours
      legends: KeysetColours
      symbols: boolean
    }
)[]

export type KeysetId = (typeof KEYSETS)[number]['id']
export type Keyset = Extract<(typeof KEYSETS)[number], { caps: KeysetColours }>

/** The chosen set, or undefined when the caps use the separate colour choices. */
export const keysetOf = (id: KeysetId): Keyset | undefined =>
  KEYSETS.find((set): set is Keyset => set.id === id && 'caps' in set)

/** Whether a set prints symbols on the big modifiers. */
export const usesSymbols = (id: KeysetId) => keysetOf(id)?.symbols ?? false
