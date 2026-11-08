import { useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { useEffect, useRef } from 'react'
import type { DirectionalLight } from 'three'
import { BRIGHTNESS, RGB_COLOURS, RGB_EFFECTS, byId } from '../data/options'
import { motion, prefersReducedMotion } from '../motion'
import { useConfig, type Config } from '../state/config'
import { isDark, useStage } from '../state/stage'
import { ledNow, uniforms } from './materials'

/** Room light. The LEDs only read properly once it goes down. */
const ROOM_BRIGHT = 1.02
const ROOM_DARK = 0.2
/** Studio light strengths in cinematic mode. */
const CINEMA_KEY = 2.4
const CINEMA_RIM = 3.2
/** Cinematic mode keeps some room light, so the board reads even with its LEDs off. */
const ROOM_CINEMA = 0.32
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
        environmentIntensity:
          useStage.getState().mode === 'cinematic' ? ROOM_CINEMA : dark ? ROOM_DARK : ROOM_BRIGHT,
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

  // Studio lights for cinematic mode: a warm key from the front left, a cool rim from behind.
  const key = useRef<DirectionalLight>(null)
  const rim = useRef<DirectionalLight>(null)
  useEffect(() => {
    const fade = (cinematic: boolean) => {
      for (const [light, strength] of [
        [key.current, CINEMA_KEY],
        [rim.current, CINEMA_RIM],
      ] as const) {
        if (!light) continue
        gsap.to(light, {
          intensity: cinematic ? strength : 0,
          duration: motion(cinematic ? 1.6 : 0.6),
          overwrite: true,
        })
      }
    }
    fade(useStage.getState().mode === 'cinematic')
    return useStage.subscribe((state, previous) => {
      if (state.mode !== previous.mode) fade(state.mode === 'cinematic')
    })
  }, [])

  return (
    <>
      <directionalLight ref={key} position={[-30, 26, 24]} color="#ffd9b0" intensity={0} />
      <directionalLight ref={rim} position={[24, 14, -32]} color="#9ec3ff" intensity={0} />
    </>
  )
}
