import gsap from 'gsap'
import { useEffect } from 'react'
import { Color } from 'three'
import {
  CABLES,
  CASE_COLOURS,
  DESK_MATS,
  FINISHES,
  KEYCAP_COLOURS,
  KNOBS,
  LEGEND_COLOURS,
  PLATES,
  SWITCHES,
  byId,
} from '../data/options'
import { preloadSwitch } from '../audio/engine'
import { motion } from '../motion'
import { useConfig, type Config } from '../state/config'
import type { KeyboardRig } from './KeyboardRig'
import { uniforms } from './materials'

const COLOUR_SECONDS = 0.35

function tweenColour(target: { value: Color }, hex: string, duration: number) {
  const next = new Color(hex)
  gsap.to(target.value, {
    r: next.r,
    g: next.g,
    b: next.b,
    duration,
    ease: 'power2.out',
    overwrite: true,
  })
}

function applyConfig(rig: KeyboardRig, config: Config, duration: number) {
  tweenColour(uniforms.case, byId(CASE_COLOURS, config.case).hex, duration)
  tweenColour(uniforms.alpha, byId(KEYCAP_COLOURS, config.alpha).hex, duration)
  tweenColour(uniforms.mod, byId(KEYCAP_COLOURS, config.mod).hex, duration)
  tweenColour(uniforms.accent, byId(KEYCAP_COLOURS, config.accent).hex, duration)
  tweenColour(uniforms.legend, byId(LEGEND_COLOURS, config.legend).hex, duration)

  const finish = byId(FINISHES, config.finish)
  gsap.to(uniforms.keycapRoughness, { value: finish.roughness, duration, overwrite: true })
  gsap.to(uniforms.keycapGrain, { value: finish.grain, duration, overwrite: true })

  const plate = byId(PLATES, config.plate)
  tweenColour(uniforms.plate, plate.hex, duration)
  gsap.to(uniforms.plateMetalness, { value: plate.metalness, duration, overwrite: true })
  gsap.to(uniforms.plateRoughness, { value: plate.roughness, duration, overwrite: true })

  const knob = byId(KNOBS, config.knob)
  tweenColour(uniforms.knob, knob.hex, duration)
  gsap.to(uniforms.knobMetalness, { value: knob.metalness, duration, overwrite: true })
  gsap.to(uniforms.knobRoughness, { value: knob.roughness, duration, overwrite: true })

  // A new cable or mat appears in its colour; only a change of colour is tweened.
  if (config.cable !== 'none') {
    tweenColour(
      uniforms.cable,
      byId(CABLES, config.cable).hex,
      rig.desk.cable.visible ? duration : 0,
    )
  }
  if (config.mat !== 'none') {
    tweenColour(uniforms.mat, byId(DESK_MATS, config.mat).hex, rig.desk.mat.visible ? duration : 0)
  }
  rig.desk.setCable(config.cable !== 'none')
  rig.desk.setMat(config.mat !== 'none')

  const switchOption = byId(SWITCHES, config.switch)
  tweenColour(uniforms.stem, switchOption.stemHex, duration)
  rig.travel = switchOption.travel
}

/** Keeps the 3D scene matching the configuration. Renders nothing. */
export function ConfigSync({ rig }: { rig: KeyboardRig }) {
  useEffect(() => {
    const { config } = useConfig.getState()
    applyConfig(rig, config, 0)
    rig.setProfile(config.profile)
    return useConfig.subscribe((state, previous) => {
      if (state.config === previous.config) return
      applyConfig(rig, state.config, motion(COLOUR_SECONDS))
      if (state.config.switch !== previous.config.switch) preloadSwitch(state.config.switch)
      if (state.config.profile !== previous.config.profile) {
        rig.changeProfile(state.config.profile)
      }
    })
  }, [rig])

  return null
}
