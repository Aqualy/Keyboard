import { describe, expect, it } from 'vitest'
import { PLATES, SWITCHES } from '../data/options'
import { clickRecipe, playbackVariation, renderClick } from './synth'

const RATE = 44100
const peak = (samples: Float32Array) => samples.reduce((max, s) => Math.max(max, Math.abs(s)), 0)

describe('renderClick', () => {
  const combos = SWITCHES.flatMap((s) => PLATES.map((p) => [s.id, p.id] as const))

  it.each(combos)('%s on %s stays finite and within range', (switchId, plate) => {
    for (const edge of ['press', 'release'] as const) {
      for (const long of [false, true]) {
        const samples = renderClick(clickRecipe(switchId, plate, edge, long), RATE)
        expect(samples.length).toBeGreaterThan(0)
        expect(samples.every(Number.isFinite)).toBe(true)
        expect(peak(samples)).toBeLessThanOrEqual(1)
        expect(peak(samples)).toBeGreaterThan(0.05)
      }
    }
  })

  it('is deterministic for a seed and varies across seeds', () => {
    const recipe = clickRecipe('linear', 'pc', 'press', false)
    expect(renderClick(recipe, RATE, 7)).toEqual(renderClick(recipe, RATE, 7))
    expect(renderClick(recipe, RATE, 7)).not.toEqual(renderClick(recipe, RATE, 8))
  })

  it('ends silently', () => {
    const samples = renderClick(clickRecipe('clicky', 'brass', 'press', true), RATE)
    expect(samples.at(-1)).toBeCloseTo(0)
  })

  it('makes releases quieter than presses', () => {
    const press = renderClick(clickRecipe('linear', 'pc', 'press', false), RATE)
    const release = renderClick(clickRecipe('linear', 'pc', 'release', false), RATE)
    expect(peak(release)).toBeLessThan(peak(press))
  })
})

describe('clickRecipe', () => {
  it('only gives clicking switches a click transient', () => {
    expect(clickRecipe('linear', 'pc', 'press', false).clickGain).toBe(0)
    expect(clickRecipe('clicky', 'pc', 'press', false).clickGain).toBeGreaterThan(
      clickRecipe('tactile', 'pc', 'press', false).clickGain,
    )
  })

  it('tunes pitch by plate', () => {
    const pc = clickRecipe('linear', 'pc', 'press', false)
    const aluminium = clickRecipe('linear', 'aluminium', 'press', false)
    expect(aluminium.thumpHz).toBeGreaterThan(pc.thumpHz)
  })

  it('makes long keys deeper', () => {
    const normal = clickRecipe('linear', 'pc', 'press', false)
    const long = clickRecipe('linear', 'pc', 'press', true)
    expect(long.thumpHz).toBeLessThan(normal.thumpHz)
  })
})

describe('playbackVariation', () => {
  it('keeps pitch within 5% and gain at or below full', () => {
    for (const roll of [0, 0.5, 0.999]) {
      const { rate, gain } = playbackVariation(0, 15, () => roll)
      expect(Math.abs(rate - 1)).toBeLessThanOrEqual(0.05)
      expect(gain).toBeLessThanOrEqual(1)
    }
  })

  it('pans by key position and clamps at the edges', () => {
    expect(playbackVariation(-15, 15).pan).toBeCloseTo(-0.45)
    expect(playbackVariation(0, 15).pan).toBeCloseTo(0)
    expect(playbackVariation(99, 15).pan).toBeCloseTo(0.45)
  })
})
