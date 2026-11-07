import type { PlateId, SwitchId } from '../data/options'

export type KeyEdge = 'press' | 'release'

export interface ClickRecipe {
  /** Low body of the sound, in Hz, with its decay time in seconds. */
  thumpHz: number
  thumpDecay: number
  thumpGain: number
  /** Bright contact noise. */
  noiseGain: number
  noiseDecay: number
  /** One-pole low-pass amount from 0 (dark) to 1 (open). */
  brightness: number
  /** Extra transient for tactile and clicky switches, delayed in seconds. */
  clickDelay: number
  clickGain: number
  peak: number
}

const SWITCH_RECIPES: Record<SwitchId, Omit<ClickRecipe, 'peak'>> = {
  linear: {
    thumpHz: 170,
    thumpDecay: 0.026,
    thumpGain: 1,
    noiseGain: 0.42,
    noiseDecay: 0.009,
    brightness: 0.34,
    clickDelay: 0,
    clickGain: 0,
  },
  tactile: {
    thumpHz: 195,
    thumpDecay: 0.024,
    thumpGain: 0.9,
    noiseGain: 0.5,
    noiseDecay: 0.01,
    brightness: 0.46,
    clickDelay: 0.007,
    clickGain: 0.42,
  },
  clicky: {
    thumpHz: 215,
    thumpDecay: 0.022,
    thumpGain: 0.7,
    noiseGain: 0.6,
    noiseDecay: 0.008,
    brightness: 0.82,
    clickDelay: 0.006,
    clickGain: 1,
  },
}

const PLATE_TONE: Record<PlateId, { pitch: number; ring: number; brightness: number }> = {
  pc: { pitch: 0.84, ring: 1.3, brightness: 0.8 },
  fr4: { pitch: 1, ring: 1, brightness: 1 },
  aluminium: { pitch: 1.22, ring: 0.85, brightness: 1.18 },
  brass: { pitch: 1.08, ring: 1.75, brightness: 1.05 },
}

export function clickRecipe(
  switchId: SwitchId,
  plate: PlateId,
  edge: KeyEdge,
  isLongKey: boolean,
): ClickRecipe {
  const base = SWITCH_RECIPES[switchId]
  const tone = PLATE_TONE[plate]
  const release = edge === 'release'
  return {
    ...base,
    thumpHz: base.thumpHz * tone.pitch * (isLongKey ? 0.72 : 1) * (release ? 1.5 : 1),
    thumpDecay: base.thumpDecay * tone.ring * (isLongKey ? 1.5 : 1) * (release ? 0.6 : 1),
    thumpGain: base.thumpGain * (release ? 0.45 : 1),
    brightness: Math.min(base.brightness * tone.brightness * (release ? 1.1 : 1), 1),
    clickGain: release ? 0 : base.clickGain,
    peak: release ? 0.26 : 0.55,
  }
}

/** Small seeded generator, so a recipe always renders the same samples. */
function random(seed: number) {
  let state = seed >>> 0 || 1
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state / 2147483648 - 1
  }
}

export function renderClick(recipe: ClickRecipe, sampleRate: number, seed = 1): Float32Array {
  const seconds = Math.max(recipe.thumpDecay * 6, recipe.noiseDecay * 6, 0.05)
  const samples = new Float32Array(Math.ceil(seconds * sampleRate))
  const noise = random(seed)
  let smooth = 0
  const clickStart = recipe.clickDelay * sampleRate

  for (let i = 0; i < samples.length; i += 1) {
    const time = i / sampleRate
    const thump =
      Math.sin(Math.PI * 2 * recipe.thumpHz * time) *
      Math.exp(-time / recipe.thumpDecay) *
      recipe.thumpGain

    const white = noise()
    smooth += recipe.brightness * (white - smooth)
    const contact = smooth * Math.exp(-time / recipe.noiseDecay) * recipe.noiseGain

    let click = 0
    if (recipe.clickGain > 0 && i >= clickStart) {
      const clickTime = time - recipe.clickDelay
      click = (white - smooth) * Math.exp(-clickTime / 0.003) * recipe.clickGain
    }
    samples[i] = thump + contact + click
  }

  let loudest = 0
  for (const sample of samples) loudest = Math.max(loudest, Math.abs(sample))
  const scale = loudest > 0 ? recipe.peak / loudest : 0
  for (let i = 0; i < samples.length; i += 1) samples[i] *= scale

  // A short fade prevents a click at the end of the buffer.
  const fade = Math.min(Math.floor(sampleRate * 0.004), samples.length)
  for (let i = 0; i < fade; i += 1) samples[samples.length - 1 - i] *= i / fade
  return samples
}

/** Per-play humanisation, keeping repeated keys from sounding identical. */
export function playbackVariation(x: number, keyboardHalfWidth: number, roll = Math.random) {
  return {
    rate: 1 + (roll() - 0.5) * 0.09,
    gain: 0.86 + roll() * 0.14,
    pan: Math.max(-1, Math.min(1, x / keyboardHalfWidth)) * 0.45,
  }
}
