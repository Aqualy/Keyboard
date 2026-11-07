import ansi65 from './layouts/65-ansi.json'
import iso65 from './layouts/65-iso.json'
import ansi75 from './layouts/75-ansi.json'
import iso75 from './layouts/75-iso.json'
import ansiTkl from './layouts/tkl-ansi.json'
import isoTkl from './layouts/tkl-iso.json'
import { legendFor, type RegionId, type Standard } from './regions'

export type KeyZone = 'alpha' | 'mod' | 'accent'

export interface KeyDefinition {
  code: string
  legend: string[]
  width: number
  zone: KeyZone
  /** Sculpted row, 0 for the top two rows down to 4 for the bottom row. */
  row: number
  x: number
  y: number
  stabilized: boolean
  homing: boolean
  /** Set for keys that are not a plain rectangle. */
  shape?: 'isoEnter'
  /** Where the legend is printed, when it is not over the switch. */
  legendAt?: { x: number; y: number }
}

export const SIZES = [
  { id: '65', name: '65%' },
  { id: '75', name: '75%' },
  { id: 'tkl', name: 'TKL' },
] as const

export const STANDARDS = [
  { id: 'ansi', name: 'ANSI' },
  { id: 'iso', name: 'ISO' },
] as const satisfies readonly { id: Standard; name: string }[]

export type SizeId = (typeof SIZES)[number]['id']

export interface Layout {
  id: string
  size: SizeId
  standard: Standard
  name: string
  pitch: number
  columns: number
  rows: number
  knob: { x: number; y: number; radius: number; wellMargin: number }
  keycapBaseZ: number
  indicator: { x: number; y: number; width: number; depth: number } | null
  case: {
    width: number
    depth: number
    cornerRadius: number
    topZ: number
    partingZ: number
    frontBottomZ: number
    tiltDegrees: number
    seamStartY: number
    seamEndY: number
  }
  screws: number[][]
  keys: KeyDefinition[]
}

export const LAYOUTS = [ansi65, iso65, ansi75, iso75, ansiTkl, isoTkl] as unknown as Layout[]

export function layoutFor(size: SizeId, standard: Standard): Layout {
  const found = LAYOUTS.find((layout) => layout.size === size && layout.standard === standard)
  if (!found) throw new Error(`Unknown layout: ${size}-${standard}`)
  return found
}

const keyMaps = new WeakMap<Layout, Map<string, KeyDefinition>>()

export function keyByCode(layout: Layout) {
  let map = keyMaps.get(layout)
  if (!map) {
    map = new Map(layout.keys.map((key) => [key.code, key]))
    keyMaps.set(layout, map)
  }
  return map
}

/** A layout's keys with the legends a region prints on them. */
export function withLegends(layout: Layout, region: RegionId): KeyDefinition[] {
  return layout.keys.map((key) => ({
    ...key,
    legend: [...legendFor(region, key.code, key.legend)],
  }))
}

/** Rows use one of four sculpted heights. The bottom row shares the fourth. */
export const sculptRow = (row: number) => Math.min(row + 1, 4)

/** Name of the keycap mesh for a key, as exported by the Blender script. */
export const keycapMeshName = (key: KeyDefinition) =>
  key.shape === 'isoEnter'
    ? 'iso_enter'
    : `w${Math.round(key.width * 100)}_r${sculptRow(key.row)}${key.homing ? '_h' : ''}`
