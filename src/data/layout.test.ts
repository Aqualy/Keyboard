import { describe, expect, it } from 'vitest'
import { KEY_BY_CODE, KEYS, keycapMeshName, LAYOUT } from './layout'

describe('GMK67 layout', () => {
  it('has 66 uniquely identified keys', () => {
    expect(KEYS).toHaveLength(66)
    expect(KEY_BY_CODE.size).toBe(66)
  })

  it.each([
    [0, 14],
    [1, 15],
    [2, 14],
    [3, 14],
    [4, 9],
  ])('row %i has %i keys', (row, count) => {
    expect(KEYS.filter((key) => key.row === row)).toHaveLength(count)
  })

  it('never overlaps keys in a row', () => {
    for (let row = 0; row < LAYOUT.rows; row += 1) {
      const sorted = KEYS.filter((key) => key.row === row).sort((a, b) => a.x - b.x)
      for (let i = 1; i < sorted.length; i += 1) {
        const span = ((sorted[i - 1].width + sorted[i].width) / 2) * LAYOUT.pitch
        expect(sorted[i].x - sorted[i - 1].x).toBeGreaterThanOrEqual(span - 0.001)
      }
    }
  })

  it('keeps every key inside the 16u footprint', () => {
    const half = (LAYOUT.columns / 2) * LAYOUT.pitch
    for (const key of KEYS) {
      const keyHalf = (key.width / 2) * LAYOUT.pitch
      expect(Math.abs(key.x) + keyHalf).toBeLessThanOrEqual(half + 0.001)
    }
  })

  it('leaves room for the knob and the indicator', () => {
    const clash = (x: number, y: number) =>
      KEYS.some(
        (key) =>
          Math.abs(key.x - x) < ((key.width + 1) / 2) * LAYOUT.pitch - 0.001 &&
          Math.abs(key.y - y) < LAYOUT.pitch - 0.001,
      )
    expect(clash(LAYOUT.knob.x, LAYOUT.knob.y)).toBe(false)
    expect(clash(LAYOUT.indicator.x, LAYOUT.indicator.y)).toBe(false)
  })

  it('stabilises the four long keys only', () => {
    expect(
      KEYS.filter((key) => key.stabilized)
        .map((key) => key.code)
        .sort(),
    ).toEqual(['Backspace', 'Enter', 'ShiftLeft', 'Space'])
  })

  it('names keycap meshes by width, sculpt row and homing bump', () => {
    expect(keycapMeshName(KEY_BY_CODE.get('Space')!)).toBe('w625_r4')
    expect(keycapMeshName(KEY_BY_CODE.get('KeyJ')!)).toBe('w100_r3_h')
    expect(keycapMeshName(KEY_BY_CODE.get('Escape')!)).toBe('w100_r1')
  })
})
