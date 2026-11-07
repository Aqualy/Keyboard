/// <reference types="node" />
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { keyByCode, LAYOUTS, layoutFor } from '../data/layout'
import { hasLongKeySamples, PLATES, SWITCHES } from '../data/options'
import {
  PLATE_TONES,
  playbackVariation,
  PRESS_SAMPLES,
  RELEASE_SAMPLES,
  samplePaths,
  sampleName,
  SWITCH_LOUDNESS,
  switchGain,
  TARGET_LUFS,
} from './samples'

const key = (code: string) => keyByCode(layoutFor('65', 'ansi')).get(code)!

describe('sampleName', () => {
  it.each([
    ['Backspace', 'press/BACKSPACE', 'release/BACKSPACE'],
    ['Enter', 'press/ENTER', 'release/ENTER'],
    ['Space', 'press/SPACE', 'release/SPACE'],
  ])('gives %s its own recording', (code, press, release) => {
    expect(sampleName(key(code), 'press')).toBe(press)
    expect(sampleName(key(code), 'release')).toBe(release)
  })

  it('varies presses by row', () => {
    expect(sampleName(key('Digit1'), 'press')).toBe('press/GENERIC_R0')
    expect(sampleName(key('KeyQ'), 'press')).toBe('press/GENERIC_R1')
    expect(sampleName(key('KeyA'), 'press')).toBe('press/GENERIC_R2')
    expect(sampleName(key('KeyZ'), 'press')).toBe('press/GENERIC_R3')
    expect(sampleName(key('ArrowLeft'), 'press')).toBe('press/GENERIC_R4')
  })

  it('shares one release for regular keys', () => {
    expect(sampleName(key('KeyA'), 'release')).toBe('release/GENERIC')
  })

  it('uses row sounds for a switch with no long key recordings', () => {
    expect(sampleName(key('Space'), 'press', false)).toBe('press/GENERIC_R4')
    expect(sampleName(key('Enter'), 'release', false)).toBe('release/GENERIC')
    expect(samplePaths(false)).toHaveLength(6)
  })

  it('only ever names a known sample', () => {
    const known = [
      ...PRESS_SAMPLES.map((name) => `press/${name}`),
      ...RELEASE_SAMPLES.map((name) => `release/${name}`),
    ]
    for (const candidate of LAYOUTS.flatMap((layout) => layout.keys)) {
      expect(known).toContain(sampleName(candidate, 'press'))
      expect(known).toContain(sampleName(candidate, 'release'))
    }
  })
})

describe('sound files', () => {
  const files = SWITCHES.flatMap((option) =>
    samplePaths(hasLongKeySamples(option.id)).map((path) => `${option.id}/${path}`),
  )

  it.each(files)('%s.mp3 exists and is not empty', (file) => {
    const path = join(process.cwd(), 'public/sounds', `${file}.mp3`)
    expect(existsSync(path)).toBe(true)
    expect(statSync(path).size).toBeGreaterThan(500)
  })

  it('keeps the licence with the recordings', () => {
    expect(existsSync(join(process.cwd(), 'public/sounds/LICENSE.md'))).toBe(true)
  })
})

describe('PLATE_TONES', () => {
  it('covers every plate', () => {
    for (const plate of PLATES) expect(PLATE_TONES[plate.id]).toBeDefined()
  })

  it('makes aluminium brighter than PC', () => {
    expect(PLATE_TONES.aluminium.pitch).toBeGreaterThan(PLATE_TONES.pc.pitch)
    expect(PLATE_TONES.aluminium.cutoff).toBeGreaterThan(PLATE_TONES.pc.cutoff)
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

describe('switchGain', () => {
  const decibels = (gain: number) => 20 * Math.log10(gain)
  const loudestPlate = Math.max(...Object.values(PLATE_TONES).map((tone) => tone.gain))

  it('has a measurement for every switch', () => {
    expect(Object.keys(SWITCH_LOUDNESS).sort()).toEqual(SWITCHES.map((option) => option.id).sort())
  })

  it.each(SWITCHES.map((option) => option.id))('brings %s to the shared loudness', (id) => {
    expect(SWITCH_LOUDNESS[id].lufs + decibels(switchGain(id))).toBeCloseTo(TARGET_LUFS, 6)
  })

  it.each(SWITCHES.map((option) => option.id))(
    'keeps %s 1 dB under clipping on the loudest plate',
    (id) => {
      const peak = SWITCH_LOUDNESS[id].peak + decibels(switchGain(id) * loudestPlate)
      expect(peak).toBeLessThanOrEqual(-1)
    },
  )
})
