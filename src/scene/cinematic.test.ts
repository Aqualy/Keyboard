import { describe, expect, it } from 'vitest'
import { layoutFor } from '../data/layout'
import { cinematicFrame, cinematicShots, FADE_SECONDS, SHOT_SECONDS } from './cinematic'

const shots = cinematicShots(layoutFor('65', 'ansi'))

describe('cinematic mode', () => {
  it('loops through every shot and starts again', () => {
    const indices = shots.map((_, i) => cinematicFrame(shots, i * SHOT_SECONDS + 1).index)
    expect(indices).toEqual(shots.map((_, i) => i))
    expect(cinematicFrame(shots, shots.length * SHOT_SECONDS + 1).index).toBe(0)
  })

  it('dips to black between shots and is clear in the middle', () => {
    expect(cinematicFrame(shots, 0).fade).toBe(1)
    expect(cinematicFrame(shots, SHOT_SECONDS / 2).fade).toBe(0)
    expect(cinematicFrame(shots, SHOT_SECONDS - FADE_SECONDS / 2).fade).toBeCloseTo(0.5)
  })

  it('moves from the start of a shot to its end', () => {
    const start = cinematicFrame(shots, 0).position
    const end = cinematicFrame(shots, SHOT_SECONDS - 0.001).position
    expect(start).toEqual(shots[0].from.position)
    expect(end[0]).toBeCloseTo(shots[0].to.position[0], 2)
  })

  it('holds still mid-shot for visitors who ask for less motion', () => {
    const early = cinematicFrame(shots, 1, true).position
    const late = cinematicFrame(shots, SHOT_SECONDS - 1, true).position
    expect(early).toEqual(late)
  })

  it('pulls back for wider boards', () => {
    const tkl = cinematicShots(layoutFor('tkl', 'ansi'))
    expect(Math.abs(tkl[4].from.position[0])).toBeGreaterThan(Math.abs(shots[4].from.position[0]))
  })
})
