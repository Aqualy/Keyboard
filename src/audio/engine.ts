import { hasLongKeySamples, type SwitchId } from '../data/options'
import { currentKey, currentLayout, useConfig } from '../state/config'
import { switchForKey, useStage } from '../state/stage'
import {
  PLATE_TONES,
  playbackVariation,
  samplePaths,
  sampleName,
  soundOnset,
  switchGain,
  type KeyEdge,
} from './samples'

const KNOB_PITCH = 1.7
const KNOB_GAIN = 0.5

const url = (switchId: SwitchId, sample: string) =>
  `${import.meta.env.BASE_URL}sounds/${switchId}/${sample}.mp3`

let context: AudioContext | undefined
const decoded = new Map<SwitchId, Promise<Map<string, AudioBuffer>>>()
/** Where each recording's sound starts, so playback skips its leading silence. */
const onsets = new WeakMap<AudioBuffer, number>()

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
  const buffer = await audio.decodeAudioData(await response.arrayBuffer())
  onsets.set(buffer, soundOnset(buffer.getChannelData(0), buffer.sampleRate))
  return [sample, buffer] as const
}

function loadSwitch(audio: AudioContext, switchId: SwitchId) {
  const cached = decoded.get(switchId)
  if (cached) return cached
  const loading = Promise.all(
    samplePaths(hasLongKeySamples(switchId)).map((sample) => decodeSample(audio, switchId, sample)),
  ).then((entries) => new Map(entries))
  // A failed load is forgotten, so the next key press tries again.
  loading.catch(() => decoded.delete(switchId))
  decoded.set(switchId, loading)
  return loading
}

function play(
  audio: AudioContext,
  buffer: AudioBuffer,
  switchId: SwitchId,
  x: number,
  pitch = 1,
  level = 1,
) {
  const { plate } = useConfig.getState().config
  // Squared, so each knob click sounds like an even step in loudness.
  const volumeLevel = useStage.getState().volume ** 2
  const tone = PLATE_TONES[plate]
  const layout = currentLayout()
  const { rate, gain, pan } = playbackVariation(x, (layout.columns * layout.pitch) / 2)

  const source = audio.createBufferSource()
  source.buffer = buffer
  source.playbackRate.value = rate * tone.pitch * pitch

  const filter = audio.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = tone.cutoff

  const volume = audio.createGain()
  volume.gain.value = gain * tone.gain * switchGain(switchId) * level * volumeLevel

  const panner = audio.createStereoPanner()
  panner.pan.value = pan

  source.connect(filter).connect(volume).connect(panner).connect(audio.destination)
  source.start(0, onsets.get(buffer) ?? 0)
}

async function playSample(
  switchId: SwitchId,
  sample: string,
  x: number,
  pitch?: number,
  level?: number,
) {
  if (!useStage.getState().soundOn) return
  const audio = audioContext()
  if (!audio) return
  try {
    const samples = await loadSwitch(audio, switchId)
    const buffer = samples.get(sample)
    if (buffer) play(audio, buffer, switchId, x, pitch, level)
  } catch {
    // Sound is a bonus. The keyboard keeps working without it.
  }
}

export function playKey(code: string, edge: KeyEdge) {
  const key = currentKey(code)
  if (!key) return
  const switchId = switchForKey(
    key.x,
    useConfig.getState().config.switch,
    useStage.getState().compare,
  )
  void playSample(switchId, sampleName(key, edge, hasLongKeySamples(switchId)), key.x)
}

export function playKnobTick() {
  const { switch: switchId } = useConfig.getState().config
  void playSample(switchId, 'release/GENERIC', currentLayout().knob.x, KNOB_PITCH, KNOB_GAIN)
}

/** Decodes a switch ahead of use, once sound has started, so changing it has no delay. */
export function preloadSwitch(switchId: SwitchId) {
  if (context) void loadSwitch(context, switchId).catch(() => undefined)
}
