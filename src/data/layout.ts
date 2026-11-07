import layout from './layout.gmk67.json'

export type KeyZone = 'alpha' | 'mod' | 'accent'

export interface KeyDefinition {
  code: string
  legend: string[]
  width: number
  zone: KeyZone
  row: number
  x: number
  y: number
  stabilized: boolean
  homing: boolean
}

export const LAYOUT = layout as unknown as Omit<typeof layout, 'keys'> & { keys: KeyDefinition[] }
export const KEYS = LAYOUT.keys
export const KEY_BY_CODE = new Map(KEYS.map((key) => [key.code, key]))

/** Rows use one of four sculpted heights. The bottom row shares the fourth. */
export const sculptRow = (row: number) => Math.min(row + 1, 4)

/** Name of the keycap mesh for a key, as exported by the Blender script. */
export const keycapMeshName = (key: KeyDefinition) =>
  `w${Math.round(key.width * 100)}_r${sculptRow(key.row)}${key.homing ? '_h' : ''}`
