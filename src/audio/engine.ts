import { KEY_BY_CODE, LAYOUT } from '../data/layout'
import type { SwitchId } from '../data/options'
import { useConfig } from '../state/config'
import { useStage } from '../state/stage'
import {
  PLATE_TONES,
  playbackVariation,
  PRESS_SAMPLES,
  RELEASE_SAMPLES,
  sampleName,
  type KeyEdge,
} from './samples'

const KEYBOARD_HALF_WIDTH = (LAYOUT.columns * LAYOUT.pitch) / 2
const KNOB_PITCH = 1.7
const KNOB_GAIN = 0.5

const SAMPLE_PATHS = [
  ...PRESS_SAMPLES.map((name) => `press/${name}`),
  ...RELEASE_SAMPLES.map((name) => `release/${name}`),
]

const url = (switchId: SwitchId, sample: string) =>
  `${import.meta.env.BASE_URL}sounds/${switchId}/${sample}.mp3`

let context: AudioContext | undefined
const decoded = new Map<SwitchId, Promise<Map<string, AudioBuffer>>>()

function audioContext() {
  if (!context) {
    const Context = window.AudioContext
    if (!Context) return undefined
    context = new Context()
  }
  // Browsers start the context suspended until the user interacts.
  if (context.state === 'suspended') void context.resume()
  return context
}

async function decodeSample(audio: AudioContext, switchId: SwitchId, sample: string) {
  const response = await fetch(url(switchId, sample))
  if (!response.ok) throw new Error(`Could not load sound: ${sample}`)
  return [sample, await audio.decodeAudioData(await response.arrayBuffer())] as const
}

function loadSwitch(audio: AudioContext, switchId: SwitchId) {
  const cached = decoded.get(switchId)
  if (cached) return cached
  const loading = Promise.all(
    SAMPLE_PATHS.map((sample) => decodeSample(audio, switchId, sample)),
  ).then((entries) => new Map(entries))
  // A failed load is forgotten, so the next key press tries again.
  loading.catch(() => decoded.delete(switchId))
  decoded.set(switchId, loading)
  return loading
}

function play(audio: AudioContext, buffer: AudioBuffer, x: number, pitch = 1, level = 1) {
  const tone = PLATE_TONES[useConfig.getState().config.plate]
  const { rate, gain, pan } = playbackVariation(x, KEYBOARD_HALF_WIDTH)

  const source = audio.createBufferSource()
  source.buffer = buffer
  source.playbackRate.value = rate * tone.pitch * pitch

  const filter = audio.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = tone.cutoff

  const volume = audio.createGain()
  volume.gain.value = gain * tone.gain * level

  const panner = audio.createStereoPanner()
  panner.pan.value = pan

  source.connect(filter).connect(volume).connect(panner).connect(audio.destination)
  source.start()
}

async function playSample(sample: string, x: number, pitch?: number, level?: number) {
  if (!useStage.getState().soundOn) return
  const audio = audioContext()
  if (!audio) return
  try {
    const samples = await loadSwitch(audio, useConfig.getState().config.switch)
    const buffer = samples.get(sample)
    if (buffer) play(audio, buffer, x, pitch, level)
  } catch {
    // Sound is a bonus. The keyboard keeps working without it.
  }
}

export function playKey(code: string, edge: KeyEdge) {
  const key = KEY_BY_CODE.get(code)
  if (key) void playSample(sampleName(key, edge), key.x)
}

export function playKnobTick() {
  void playSample('release/GENERIC', LAYOUT.knob.x, KNOB_PITCH, KNOB_GAIN)
}

/** Decodes a switch ahead of use, once sound has started, so changing it has no delay. */
export function preloadSwitch(switchId: SwitchId) {
  if (context) void loadSwitch(context, switchId).catch(() => undefined)
}
