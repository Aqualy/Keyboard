import { describe, expect, it } from 'vitest'
import { SECTIONS } from '../state/stage'
import { arrangementFor, LAYERS, liftsFor, staggerOrder } from './layers'

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

describe('staggerOrder', () => {
  const ids = LAYERS.map((layer) => layer.id)
  /** Simulates the shared ease with each layer's delay and checks no layer dips below the next. */
  function neverCrosses(from: Map<string, number>, to: Map<string, number>) {
    const ease = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)
    const step = 0.03
    const duration = 1
    for (let time = 0; time <= duration + ids.length * step; time += 0.005) {
      const heights = ids.map((id, index) => {
        const start = from.get(id)!
        const end = to.get(id)!
        const t = Math.min(
          Math.max((time - staggerOrder(index, start, end) * step) / duration, 0),
          1,
        )
        return start + (end - start) * ease(t)
      })
      for (let index = 0; index < heights.length - 1; index++) {
        if (heights[index] < heights[index + 1] - 1e-9) return false
      }
    }
    return true
  }

  it('assembles from exploded without any layer passing through the one below', () => {
    expect(neverCrosses(liftsFor('exploded'), liftsFor('assembled'))).toBe(true)
  })

  it('explodes without any layer passing through the one below', () => {
    expect(neverCrosses(liftsFor('assembled'), liftsFor('exploded'))).toBe(true)
  })

  it.each(['keycaps', 'switches', 'plate'] as const)(
    'isolates and returns %s without crossing',
    (focus) => {
      const isolated = liftsFor({ isolate: focus })
      expect(neverCrosses(liftsFor('assembled'), isolated)).toBe(true)
      expect(neverCrosses(isolated, liftsFor('assembled'))).toBe(true)
      expect(neverCrosses(isolated, liftsFor('exploded'))).toBe(true)
    },
  )
})
