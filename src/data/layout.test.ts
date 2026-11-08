import { describe, expect, it } from 'vitest'
import { keyByCode, keycapMeshName, LAYOUTS, layoutFor, withLegends, type Layout } from './layout'
import { REGIONS } from './regions'

const gmk67 = layoutFor('65', 'ansi')
const keys65 = keyByCode(gmk67)

/** Keys with their real footprint, splitting an ISO Enter into its two parts. */
function footprints(layout: Layout) {
  const { pitch } = layout
  return layout.keys.flatMap((key) => {
    if (key.shape !== 'isoEnter') {
      return [{ code: key.code, x: key.x, y: key.y, half: (key.width / 2) * pitch }]
    }
    const right = key.x + 0.625 * pitch
    return [
      { code: key.code, x: right - 0.75 * pitch, y: key.y + pitch / 2, half: 0.75 * pitch },
      { code: key.code, x: right - 0.625 * pitch, y: key.y - pitch / 2, half: 0.625 * pitch },
    ]
  })
}

describe.each(LAYOUTS.map((layout) => [layout.id, layout] as const))('%s layout', (_, layout) => {
  const { pitch } = layout

  it('gives every key a unique code', () => {
    expect(keyByCode(layout).size).toBe(layout.keys.length)
  })

  it('never overlaps two keys', () => {
    const parts = footprints(layout)
    const overlaps: string[] = []
    for (const [i, a] of parts.entries()) {
      for (const b of parts.slice(i + 1)) {
        if (a.code === b.code) continue
        const apart =
          Math.abs(a.x - b.x) >= a.half + b.half - 0.001 || Math.abs(a.y - b.y) >= pitch - 0.001
        if (!apart) overlaps.push(`${a.code} and ${b.code}`)
      }
    }
    expect(overlaps).toEqual([])
  })

  it('keeps every key inside the key area', () => {
    for (const part of footprints(layout)) {
      expect(Math.abs(part.x) + part.half).toBeLessThanOrEqual((layout.columns / 2) * pitch + 0.001)
      expect(Math.abs(part.y) + pitch / 2).toBeLessThanOrEqual((layout.rows / 2) * pitch + 0.001)
    }
  })

  it('leaves the knob its own key slot in the top right corner', () => {
    const parts = footprints(layout)
    const { knob } = layout
    const inTheWay = parts.filter(
      (part) =>
        Math.abs(part.x - knob.x) < part.half + pitch / 2 - 0.001 &&
        Math.abs(part.y - knob.y) < pitch - 0.001,
    )
    expect(inTheWay.map((part) => part.code)).toEqual([])
    expect(Math.max(...parts.map((part) => part.x + part.half))).toBeCloseTo(knob.x + pitch / 2, 3)
    expect(Math.max(...parts.map((part) => part.y))).toBeCloseTo(knob.y, 3)
  })

  it('gives the indicator a clear path from the front wall, where its case tab comes in', () => {
    if (!layout.indicator) return
    const { indicator } = layout
    const back = indicator.y + indicator.depth / 2
    const inTheWay = footprints(layout).filter(
      (part) =>
        Math.abs(part.x - indicator.x) < part.half + indicator.width / 2 - 0.001 &&
        part.y - pitch / 2 < back - 0.001,
    )
    expect(inTheWay.map((part) => part.code)).toEqual([])
  })

  it('stabilises keys 2u and wider, apart from an ISO Enter', () => {
    const wrong = layout.keys.filter(
      (key) => key.stabilized !== (key.width >= 2 && key.shape !== 'isoEnter'),
    )
    expect(wrong.map((key) => key.code)).toEqual([])
  })

  it('uses only the five sculpted rows the sounds and caps exist for', () => {
    for (const key of layout.keys) expect([0, 1, 2, 3, 4]).toContain(key.row)
  })
})

describe('ANSI and ISO', () => {
  it.each(['65', '75', 'tkl'] as const)('ISO %s adds one key and an L-shaped Enter', (size) => {
    const ansi = layoutFor(size, 'ansi')
    const iso = layoutFor(size, 'iso')
    expect(iso.keys).toHaveLength(ansi.keys.length + 1)
    expect(keyByCode(iso).get('Enter')?.shape).toBe('isoEnter')
    expect(keyByCode(iso).get('IntlBackslash')).toBeDefined()
    expect(keyByCode(iso).get('ShiftLeft')?.width).toBe(1.25)
    expect(keyByCode(ansi).get('ShiftLeft')?.width).toBe(2.25)
  })
})

describe('the GMK67', () => {
  it('has 66 keys and a knob above Del', () => {
    expect(gmk67.keys).toHaveLength(66)
    const del = keys65.get('Delete')!
    expect(gmk67.knob.x).toBeCloseTo(del.x, 3)
    expect(gmk67.knob.y).toBeCloseTo(del.y + gmk67.pitch, 3)
  })

  it('matches the bottom row of the real board', () => {
    const widths = gmk67.keys.filter((key) => key.row === 4).map((key) => key.width)
    expect(widths).toEqual([1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1, 1, 1])
  })

  it('names keycap meshes by width, sculpt row and homing bump', () => {
    expect(keycapMeshName(keys65.get('Space')!)).toBe('w625_r4')
    expect(keycapMeshName(keys65.get('KeyJ')!)).toBe('w100_r3_h')
    expect(keycapMeshName(keys65.get('Escape')!)).toBe('w100_r1')
    expect(keycapMeshName(keyByCode(layoutFor('65', 'iso')).get('Enter')!)).toBe('iso_enter')
  })
})

describe('regional legends', () => {
  const iso = layoutFor('65', 'iso')
  const legend = (region: (typeof REGIONS)[number]['id'], code: string) =>
    withLegends(iso, region).find((key) => key.code === code)!.legend

  it('moves letters for AZERTY and QWERTZ', () => {
    expect(legend('fr', 'KeyQ')).toEqual(['A'])
    expect(legend('be', 'KeyA')).toEqual(['Q'])
    expect(legend('be', 'Semicolon')).toEqual(['M'])
    expect(legend('de', 'KeyY')).toEqual(['Z'])
    expect(legend('uk', 'KeyQ')).toEqual(['Q'])
  })

  it('prints the region’s symbols', () => {
    expect(legend('uk', 'Digit3')).toEqual(['£', '3'])
    expect(legend('de', 'Minus')).toEqual(['?', 'ß'])
    expect(legend('be', 'Digit2')).toEqual(['2', 'é'])
  })

  it('only ever names keys the layouts have', () => {
    const codes = new Set(LAYOUTS.flatMap((layout) => layout.keys.map((key) => key.code)))
    for (const region of REGIONS) {
      for (const code of Object.keys(region.legends)) expect([...codes]).toContain(code)
    }
  })
})
