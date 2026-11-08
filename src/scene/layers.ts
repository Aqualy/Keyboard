import type { Section, StageMode } from '../state/stage'

/** Stacked in the order of the GMK67 assembly diagram, top first. */
export const LAYERS = [
  { id: 'keycaps', label: 'Keycaps', lift: 19, parts: [] },
  { id: 'switches', label: 'Switches', lift: 15.5, parts: [] },
  { id: 'knob', label: 'Multimedia knob', lift: 13, parts: ['knob'] },
  {
    id: 'upperLid',
    label: 'Upper lid',
    lift: 10.5,
    // The LED indicator sits in a tab of the top case, so it travels with it.
    parts: ['upperLid', 'ledIndicator', 'ledIndicatorFace', 'ledIndicatorLights'],
  },
  {
    id: 'plate',
    label: 'Positioning plate',
    lift: 8,
    parts: ['plate', 'stabilizers', 'stabilizerWires'],
  },
  { id: 'plateFoam', label: 'Plate foam', lift: 6.2, parts: ['plateFoam'] },
  { id: 'pcbFoam', label: 'PCB foam', lift: 4.6, parts: ['pcbFoam'] },
  { id: 'pcb', label: 'PCB', lift: 3, parts: ['pcb', 'screws'] },
  { id: 'foamBase', label: 'Foam base', lift: 1.2, parts: ['foamBase'] },
  {
    id: 'lowerLid',
    label: 'Lower lid',
    lift: 0,
    parts: ['lowerLid', 'gasketStrips', 'feet', 'rearDark', 'rearLight'],
  },
] as const

export type LayerId = (typeof LAYERS)[number]['id']

/** How far an isolated part rises off the board, and how much higher the parts above it go. */
const ISOLATE_LIFT = 5
const ISOLATE_GAP = 7

/**
 * How the layers are spread. Assembled is the real board, exploded is every layer apart, and
 * isolating a layer lifts it clear: the layers below stay down and the ones above rise further.
 */
export type Arrangement = 'assembled' | 'exploded' | { isolate: LayerId }

/** The part each folder isolates. The case is the outside of the board, so it stays assembled. */
const ISOLATED: Record<Section, LayerId | null> = {
  // Size and standard change the whole board, so it stays together.
  layout: null,
  case: null,
  keycaps: 'keycaps',
  switches: 'switches',
  plate: 'plate',
  // Lighting runs across the whole board, so it stays together.
  lighting: null,
  // The desk is around the board, so the board stays together.
  desk: null,
}

export function arrangementFor(mode: StageMode, section: Section): Arrangement {
  if (mode === 'exploded') return 'exploded'
  const isolate = mode === 'configure' ? ISOLATED[section] : null
  return isolate ? { isolate } : 'assembled'
}

export function liftsFor(arrangement: Arrangement): Map<LayerId, number> {
  if (arrangement === 'assembled' || arrangement === 'exploded') {
    const exploded = arrangement === 'exploded'
    return new Map(LAYERS.map((layer) => [layer.id, exploded ? layer.lift : 0]))
  }
  const focus = LAYERS.findIndex((layer) => layer.id === arrangement.isolate)
  return new Map(
    LAYERS.map((layer, index) => {
      if (index > focus) return [layer.id, 0]
      if (index === focus) return [layer.id, ISOLATE_LIFT]
      return [layer.id, ISOLATE_LIFT + ISOLATE_GAP]
    }),
  )
}

/**
 * When a layer starts moving, counted in stagger steps. Layers leave top first and land bottom
 * first, so a layer never passes through the one below it.
 */
export function staggerOrder(index: number, from: number, to: number) {
  return to < from ? LAYERS.length - 1 - index : index
}
