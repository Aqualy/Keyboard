import { useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { useEffect } from 'react'
import { BRIGHTNESS, RGB_COLOURS, RGB_EFFECTS, byId } from '../data/options'
import { motion, prefersReducedMotion } from '../motion'
import { useConfig, type Config } from '../state/config'
import { isDark, useStage } from '../state/stage'
import { ledNow, uniforms } from './materials'

/** Room light. The LEDs only read properly once it goes down. */
const ROOM_BRIGHT = 1.02
const ROOM_DARK = 0.2
/** In a lit room the LEDs still show, just faintly. */
const LIT_ROOM_SHARE = 0.3
/** Reactive light only flashes, so it keeps more of its strength in a lit room. */
const LIT_ROOM_REACTIVE_SHARE = 0.65

function ledIntensity(config: Config, dark: boolean) {
  if (config.rgb === 'off') return 0
  const full = byId(BRIGHTNESS, config.brightness).intensity
  if (dark) return full
  return full * (config.rgb === 'reactive' ? LIT_ROOM_REACTIVE_SHARE : LIT_ROOM_SHARE)
}

/** Drives the LEDs and the room light. Renders nothing. */
export function Lighting() {
  const scene = useThree((state) => state.scene)

  useEffect(() => {
    uniforms.rgbSpeed.value = prefersReducedMotion() ? 0 : 1

    const apply = (config: Config, dark: boolean, wasDark: boolean, instant: boolean) => {
      uniforms.rgbEffect.value = RGB_EFFECTS.findIndex((effect) => effect.id === config.rgb)
      const colour = byId(RGB_COLOURS, config.rgbColour).hex
      const target = uniforms.rgbColour.value.clone().set(colour)
      gsap.to(uniforms.rgbColour.value, {
        r: target.r,
        g: target.g,
        b: target.b,
        duration: instant ? 0 : motion(0.35),
        overwrite: true,
      })

      // Turning the room dark: the light goes down first, then the LEDs come on after a beat,
      // like flicking a switch. Back to bright: the room comes up with no pause.
      const switchingOff = dark && !wasDark
      gsap.to(scene, {
        environmentIntensity: dark ? ROOM_DARK : ROOM_BRIGHT,
        duration: instant ? 0 : motion(dark ? 1 : 1.2),
        ease: 'power2.inOut',
        overwrite: true,
      })
      gsap.to(uniforms.rgbIntensity, {
        value: ledIntensity(config, dark),
        duration: instant ? 0 : motion(0.5),
        delay: switchingOff && !instant ? motion(0.8) : 0,
        ease: 'power2.out',
        overwrite: true,
      })
    }

    const stage = useStage.getState()
    apply(useConfig.getState().config, isDark(stage), false, true)

    const unsubscribeConfig = useConfig.subscribe((state, previous) => {
      if (state.config === previous.config) return
      const dark = isDark(useStage.getState())
      apply(state.config, dark, dark, false)
    })
    const unsubscribeStage = useStage.subscribe((state, previous) => {
      const dark = isDark(state)
      const wasDark = isDark(previous)
      if (dark !== wasDark) apply(useConfig.getState().config, dark, wasDark, false)
    })
    return () => {
      unsubscribeConfig()
      unsubscribeStage()
    }
  }, [scene])

  useFrame(() => {
    uniforms.ledClock.value = ledNow()
  })

  return null
}
