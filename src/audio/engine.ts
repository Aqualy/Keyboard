import { KEY_BY_CODE, LAYOUT } from '../data/layout'
import type { PlateId, SwitchId } from '../data/options'
import { useConfig } from '../state/config'
import { useStage } from '../state/stage'
import { clickRecipe, playbackVariation, renderClick, type KeyEdge } from './synth'

const VARIANTS = 4
const KEYBOARD_HALF_WIDTH = (LAYOUT.columns * LAYOUT.pitch) / 2

let context: AudioContext | undefined
const buffers = new Map<string, AudioBuffer[]>()

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

function variants(
  audio: AudioContext,
  switchId: SwitchId,
  plate: PlateId,
  edge: KeyEdge,
  long: boolean,
) {
  const id = `${switchId}:${plate}:${edge}:${long}`
  const cached = buffers.get(id)
  if (cached) return cached

  const rendered = Array.from({ length: VARIANTS }, (_, index) => {
    const samples = renderClick(
      clickRecipe(switchId, plate, edge, long),
      audio.sampleRate,
      index + 1,
    )
    const buffer = audio.createBuffer(1, samples.length, audio.sampleRate)
    buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0)
    return buffer
  })
  buffers.set(id, rendered)
  return rendered
}

function play(buffer: AudioBuffer, audio: AudioContext, x: number) {
  const { rate, gain, pan } = playbackVariation(x, KEYBOARD_HALF_WIDTH)
  const source = audio.createBufferSource()
  source.buffer = buffer
  source.playbackRate.value = rate
  const volume = audio.createGain()
  volume.gain.value = gain
  const panner = audio.createStereoPanner()
  panner.pan.value = pan
  source.connect(volume).connect(panner).connect(audio.destination)
  source.start()
}

export function playKey(code: string, edge: KeyEdge) {
  if (!useStage.getState().soundOn) return
  const key = KEY_BY_CODE.get(code)
  const audio = audioContext()
  if (!key || !audio) return
  const { config } = useConfig.getState()
  const set = variants(audio, config.switch, config.plate, edge, key.stabilized)
  play(set[Math.floor(Math.random() * set.length)], audio, key.x)
}

export function playKnobTick() {
  if (!useStage.getState().soundOn) return
  const audio = audioContext()
  if (!audio) return
  const { config } = useConfig.getState()
  const set = variants(audio, 'clicky', config.plate, 'release', false)
  play(set[Math.floor(Math.random() * set.length)], audio, LAYOUT.knob.x)
}
