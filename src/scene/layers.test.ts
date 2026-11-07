import { describe, expect, it } from 'vitest'
import { SECTIONS } from '../state/stage'
import { arrangementFor, LAYERS, liftsFor } from './layers'

const order = LAYERS.map((layer) => layer.id)

describe('arrangementFor', () => {
  it('keeps the board assembled for the case folder', () => {
    expect(arrangementFor('configure', 'case')).toBe('assembled')
  })

  it.each([
    ['keycaps', 'keycaps'],
    ['switches', 'switches'],
    ['plate', 'plate'],
  ] as const)('isolates the %s folder part', (section, layer) => {
    expect(arrangementFor('configure', section)).toEqual({ isolate: layer })
  })

  it('lets the explode button win over any folder', () => {
    for (const section of SECTIONS) expect(arrangementFor('exploded', section)).toBe('exploded')
  })

  it('assembles the board for the typing test', () => {
    for (const section of SECTIONS) expect(arrangementFor('test', section)).toBe('assembled')
  })
})

describe('liftsFor', () => {
  it('puts every layer down when assembled', () => {
    expect([...liftsFor('assembled').values()].every((lift) => lift === 0)).toBe(true)
  })

  it('uses each layer’s own lift when exploded', () => {
    const lifts = liftsFor('exploded')
    for (const layer of LAYERS) expect(lifts.get(layer.id)).toBe(layer.lift)
  })

  it.each(['keycaps', 'switches', 'plate'] as const)(
    'lifts %s clear, keeps lower layers down and the upper ones together above it',
    (focus) => {
      const lifts = liftsFor({ isolate: focus })
      const index = order.indexOf(focus)
      const own = lifts.get(focus)!
      expect(own).toBeGreaterThan(0)
      const above = order.slice(0, index).map((id) => lifts.get(id)!)
      const below = order.slice(index + 1).map((id) => lifts.get(id)!)
      expect(below.every((lift) => lift === 0)).toBe(true)
      expect(new Set(above).size).toBeLessThanOrEqual(1)
      for (const lift of above) expect(lift).toBeGreaterThan(own)
    },
  )
})
