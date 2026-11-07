import { useFrame, useThree } from '@react-three/fiber'
import CameraControls from 'camera-controls'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { motion, prefersReducedMotion } from '../motion'
import { useStage } from '../state/stage'
import { fitDistance } from './camera'

CameraControls.install({ THREE })

interface Shot {
  direction: [number, number, number]
  target: [number, number, number]
  width: number
  height: number
}

const SHOTS: Record<string, Shot> = {
  configure: { direction: [0, 0.63, 0.77], target: [0, 1.5, 0.5], width: 36, height: 17.5 },
  exploded: { direction: [0.62, 0.42, 0.66], target: [0, 10.5, 0], width: 41, height: 38 },
  test: { direction: [0, 0.82, 0.57], target: [0, 1.2, -1.6], width: 42, height: 24 },
}

export function CameraRig() {
  const camera = useThree((state) => state.camera)
  const domElement = useThree((state) => state.gl.domElement)
  const aspect = useThree((state) => state.size.width / state.size.height)
  const mode = useStage((state) => state.mode)
  const resetRequest = useStage((state) => state.resetRequest)
  const knobActive = useStage((state) => state.knobActive)

  const controls = useMemo(() => {
    const instance = new CameraControls(camera, domElement)
    instance.minPolarAngle = 0.15
    instance.maxPolarAngle = 1.5
    instance.smoothTime = 0.55
    instance.draggingSmoothTime = 0.12
    return instance
  }, [camera, domElement])

  useEffect(() => () => controls.dispose(), [controls])

  useEffect(() => {
    const onRest = () => {
      if (controls.currentAction !== 0) useStage.getState().markOrbited()
    }
    controls.addEventListener('control', onRest)
    return () => controls.removeEventListener('control', onRest)
  }, [controls])

  useEffect(() => {
    const shot = SHOTS[mode]
    const distance = fitDistance(shot.width, shot.height, aspect)
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
  }, [controls, mode, aspect, resetRequest])

  useEffect(() => {
    controls.enabled = !knobActive
    controls.mouseButtons.wheel = knobActive
      ? CameraControls.ACTION.NONE
      : CameraControls.ACTION.DOLLY
  }, [controls, knobActive])

  useEffect(() => {
    controls.smoothTime = motion(0.55)
  }, [controls])

  useFrame((_, delta) => {
    controls.update(delta)
  })

  return null
}
