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
import { keysetOf } from '../data/keysets'
import { motion } from '../motion'
import { useConfig, type Config } from '../state/config'
import { useStage } from '../state/stage'
import type { SwitchId } from '../data/options'
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
  // A keycap set brings its own cap colours and a legend colour per zone.
  const keyset = keysetOf(config.keyset)
  const legend = byId(LEGEND_COLOURS, config.legend).hex
  const caps = keyset?.caps ?? {
    alpha: byId(KEYCAP_COLOURS, config.alpha).hex,
    mod: byId(KEYCAP_COLOURS, config.mod).hex,
    accent: byId(KEYCAP_COLOURS, config.accent).hex,
  }
  const legends = keyset?.legends ?? { alpha: legend, mod: legend, accent: legend }
  tweenColour(uniforms.alpha, caps.alpha, duration)
  tweenColour(uniforms.mod, caps.mod, duration)
  tweenColour(uniforms.accent, caps.accent, duration)
  tweenColour(uniforms.legend, legends.alpha, duration)
  tweenColour(uniforms.legendMod, legends.mod, duration)
  tweenColour(uniforms.legendAccent, legends.accent, duration)

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

  // A new design swaps in at once, so only its colours are tweened.
  applySwitchLook(config.switch, false, duration)
  rig.travel = byId(SWITCHES, config.switch).travel
  rig.setSwitches(config.switch, useStage.getState().compare)
}

/** Sets a switch's housing and stem colours, on one half of the board or the other. */
function applySwitchLook(id: SwitchId, compared: boolean, duration: number) {
  const option = byId(SWITCHES, id)
  const set = compared
    ? {
        stem: uniforms.stemCompare,
        top: uniforms.switchTopCompare,
        topOpacity: uniforms.switchTopOpacityCompare,
        bottom: uniforms.switchBottomCompare,
        bottomOpacity: uniforms.switchBottomOpacityCompare,
      }
    : {
        stem: uniforms.stem,
        top: uniforms.switchTop,
        topOpacity: uniforms.switchTopOpacity,
        bottom: uniforms.switchBottom,
        bottomOpacity: uniforms.switchBottomOpacity,
      }
  tweenColour(set.stem, option.stemHex, duration)
  tweenColour(set.top, option.top.hex, duration)
  tweenColour(set.bottom, option.bottom.hex, duration)
  gsap.to(set.topOpacity, { value: option.top.opacity, duration, overwrite: true })
  gsap.to(set.bottomOpacity, { value: option.bottom.opacity, duration, overwrite: true })
}

function applyCompare(rig: KeyboardRig, compare: SwitchId | null) {
  uniforms.comparing.value = compare ? 1 : 0
  if (compare) {
    applySwitchLook(compare, true, 0)
    preloadSwitch(compare)
  }
  rig.setSwitches(useConfig.getState().config.switch, compare)
}

/** Keeps the 3D scene matching the configuration. Renders nothing. */
export function ConfigSync({ rig }: { rig: KeyboardRig }) {
  useEffect(() => {
    const { config } = useConfig.getState()
    applyConfig(rig, config, 0)
    rig.setProfile(config.profile)
    applyCompare(rig, useStage.getState().compare)
    const unsubscribeStage = useStage.subscribe((state, previous) => {
      if (state.compare !== previous.compare) applyCompare(rig, state.compare)
    })
    const unsubscribeConfig = useConfig.subscribe((state, previous) => {
      if (state.config === previous.config) return
      applyConfig(rig, state.config, motion(COLOUR_SECONDS))
      if (state.config.switch !== previous.config.switch) preloadSwitch(state.config.switch)
      if (state.config.profile !== previous.config.profile) {
        rig.changeProfile(state.config.profile)
      }
    })
    return () => {
      unsubscribeStage()
      unsubscribeConfig()
    }
  }, [rig])

  return null
}
