import { useFrame, useThree } from '@react-three/fiber'
import CameraControls from 'camera-controls'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { motion, prefersReducedMotion } from '../motion'
import { layoutOf, useConfig } from '../state/config'
import { useStage } from '../state/stage'
import { fitDistance } from './camera'
import { cinematicFrame, cinematicShots } from './cinematic'
import { arrangementFor } from './layers'

CameraControls.install({ THREE })

interface Shot {
  direction: [number, number, number]
  target: [number, number, number]
  width: number
  height: number
}

/** Shots are framed for the 65% case and grow with larger ones. */
const BASE_CASE = { width: 32.5, depth: 11.65 }

const SHOTS: Record<string, Shot> = {
  configure: { direction: [0, 0.63, 0.77], target: [0, 1.5, 0.5], width: 36, height: 17.5 },
  exploded: { direction: [0.62, 0.42, 0.66], target: [0, 10.5, 0], width: 41, height: 38 },
  // Isolating a part spreads the board to a height that depends on how many layers sit above it.
  'isolate-switches': { direction: [0.5, 0.5, 0.71], target: [0, 7.2, 0], width: 40, height: 31 },
  'isolate-plate': { direction: [0.5, 0.5, 0.71], target: [0, 7.2, 0], width: 40, height: 31 },
  // Pulled back and higher, so the whole desk mat and the cable's run are in view.
  desk: { direction: [0.3, 0.8, 0.52], target: [0, 0, -2.5], width: 50, height: 36 },
  test: { direction: [0, 0.51, 0.86], target: [0, 3.8, -3.6], width: 50, height: 28 },
}

export function CameraRig() {
  const camera = useThree((state) => state.camera)
  const domElement = useThree((state) => state.gl.domElement)
  const size = useThree((state) => state.size)
  const inset = useStage((state) => Math.min(state.stageInset, size.height * 0.6))
  const insetLeft = useStage((state) => Math.min(state.stageInsetLeft, size.width * 0.5))
  const free = (size.height - inset) / size.height
  // On wide screens the tools stand at the right edge, so the board keeps clear of them on both
  // sides and stays centred. The margin is the gutter, the 44px tools and a little air.
  // With the side panel folded the tools still stand there, so the margin stays.
  const folded = useStage(
    (state) => state.panelFolded && (state.mode === 'configure' || state.mode === 'exploded'),
  )
  const toolsMargin =
    (inset > 0 || insetLeft > 0 || folded) && size.width > 1000
      ? Math.min(48, Math.max(16, size.width * 0.034)) + 56
      : 0
  const fitAspect = (size.width - insetLeft - 2 * toolsMargin) / size.height
  // A string, so the selector stays stable between renders.
  const shotName = useStage((state) => {
    const arrangement = arrangementFor(state.mode, state.section)
    if (state.mode === 'cinematic') return 'cinematic'
    if (typeof arrangement === 'object') return `isolate-${arrangement.isolate}`
    return state.mode === 'configure' && state.section === 'desk' ? 'desk' : state.mode
  })
  const resetRequest = useStage((state) => state.resetRequest)
  const caseShape = useConfig((state) => layoutOf(state.config).case)
  const scale = Math.max(caseShape.width / BASE_CASE.width, caseShape.depth / BASE_CASE.depth)
  const knobActive = useStage((state) => state.knobActive)
  const knobHovered = useStage((state) => state.knobHovered)

  const controls = useMemo(() => {
    const instance = new CameraControls(camera)
    instance.minPolarAngle = 0.15
    instance.maxPolarAngle = 1.5
    instance.smoothTime = 0.55
    instance.draggingSmoothTime = 0.12
    return instance
  }, [camera])

  useEffect(() => {
    controls.connect(domElement)
    return () => controls.disconnect()
  }, [controls, domElement])

  useEffect(() => {
    const onRest = () => {
      if (controls.currentAction !== 0) useStage.getState().markOrbited()
    }
    controls.addEventListener('control', onRest)
    return () => controls.removeEventListener('control', onRest)
  }, [controls])

  useEffect(() => {
    const shot = SHOTS[shotName]
    // Cinematic mode drives the camera itself, frame by frame.
    if (!shot) return
    const distance = fitDistance(shot.width * scale, shot.height * scale, fitAspect, free)
    controls.minDistance = distance * 0.45
    controls.maxDistance = distance * 1.8
    const [dx, dy, dz] = shot.direction
    const length = Math.hypot(dx, dy, dz)
    const [tx, ty, tz] = shot.target
    void controls.setLookAt(
      tx + (dx / length) * distance,
      ty + (dy / length) * distance,
      tz + (dz / length) * distance,
      tx,
      ty,
      tz,
      !prefersReducedMotion(),
    )
  }, [controls, shotName, fitAspect, free, resetRequest, scale])

  // Shifts the picture up by half the controls' height, or right by half their width, so the
  // framed shot is centred in the free space while the scene still runs on behind them.
  useEffect(() => {
    const perspective = camera as THREE.PerspectiveCamera
    if (inset > 0 || insetLeft > 0) {
      perspective.setViewOffset(
        size.width,
        size.height,
        -insetLeft / 2,
        inset / 2,
        size.width,
        size.height,
      )
    } else {
      perspective.clearViewOffset()
    }
  }, [camera, inset, insetLeft, size.width, size.height])

  useEffect(() => {
    controls.enabled = !knobActive
    // Over the knob, the wheel turns it, so the camera must not zoom as well.
    controls.mouseButtons.wheel =
      knobActive || knobHovered ? CameraControls.ACTION.NONE : CameraControls.ACTION.DOLLY
  }, [controls, knobActive, knobHovered])

  useEffect(() => {
    controls.smoothTime = motion(0.55)
  }, [controls])

  const layout = useConfig((state) => layoutOf(state.config))
  const shots = useMemo(() => cinematicShots(layout), [layout])
  const cinematicStart = useRef(0)
  const fadeElement = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (shotName !== 'cinematic') return
    cinematicStart.current = performance.now()
    fadeElement.current = document.querySelector<HTMLElement>('.cinema-fade')
    controls.enabled = false
    return () => {
      controls.enabled = true
    }
  }, [controls, shotName])

  useFrame((_, delta) => {
    if (shotName === 'cinematic') {
      const seconds = (performance.now() - cinematicStart.current) / 1000
      const frame = cinematicFrame(shots, seconds, prefersReducedMotion())
      void controls.setLookAt(...frame.position, ...frame.target, false)
      fadeElement.current ??= document.querySelector<HTMLElement>('.cinema-fade')
      if (fadeElement.current) fadeElement.current.style.opacity = String(frame.fade)
    }
    controls.update(delta)
  })

  return null
}
