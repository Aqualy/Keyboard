import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { playKey, playKnobTick } from '../audio/engine'
import { useStage } from '../state/stage'
import { codeForCharacter } from '../test/typing'
import { createKeyTracker, shouldPressKey } from './keyInput'
import { announceKeyState, announceKeyTap, SOFT_KEY_EVENT } from './keyTap'
import type { KeyboardRig } from './KeyboardRig'
import { LAYERS } from './layers'

const DRAG_CANCEL_PIXELS = 6
const KNOB_RADIANS_PER_PIXEL = 0.012
const KNOB_TICK_RADIANS = Math.PI / 12

/** Tracks physical keys, and keeps a soft keyboard's characters on the 3D board. */
function useKeyTracker(rig: KeyboardRig) {
  const tracker = useMemo(
    () =>
      createKeyTracker({
        press: (code) => {
          rig.press(code)
          playKey(code, 'press')
          announceKeyState(code, true)
        },
        release: (code) => {
          rig.release(code)
          playKey(code, 'release')
          announceKeyState(code, false)
        },
      }),
    [rig],
  )

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (shouldPressKey(event)) tracker.down(event.code)
    }
    const up = (event: KeyboardEvent) => tracker.up(event.code)
    const releaseAll = () => tracker.releaseAll()
    const onVisibility = () => {
      if (document.hidden) tracker.releaseAll()
    }
    const onSoftKey = (event: Event) => {
      const code = codeForCharacter((event as CustomEvent<string>).detail)
      if (!code) return
      tracker.down(code)
      setTimeout(() => tracker.up(code), 90)
    }

    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', releaseAll)
    window.addEventListener(SOFT_KEY_EVENT, onSoftKey)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', releaseAll)
      window.removeEventListener(SOFT_KEY_EVENT, onSoftKey)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [tracker])

  return tracker
}

const keyCodeOf = (event: ThreeEvent<PointerEvent>): string | undefined =>
  event.instanceId === undefined ? undefined : event.object.userData.codes?.[event.instanceId]

function layerLabel(event: ThreeEvent<PointerEvent>) {
  let node: typeof event.object | null = event.object
  while (node) {
    const id = node.userData.layer
    if (id) return LAYERS.find((layer) => layer.id === id)?.label
    node = node.parent
  }
  return undefined
}

/** How long the volume stays on screen after the knob stops. */
const VOLUME_LABEL_MS = 1000
let hideVolumeTimer: ReturnType<typeof setTimeout> | undefined

/**
 * Turns the knob, which sets the volume a click at a time. Clockwise is louder, as on any
 * volume knob. Seen from above, clockwise is a negative turn around the up axis.
 */
function turnKnob(
  rig: KeyboardRig,
  radians: number,
  travel: { current: number },
  at: { x: number; y: number },
) {
  rig.rotateKnob(radians)
  travel.current += radians
  if (Math.abs(travel.current) >= KNOB_TICK_RADIANS) {
    useStage.getState().turnVolume(travel.current < 0 ? 1 : -1, at)
    travel.current = 0
    playKnobTick()
    clearTimeout(hideVolumeTimer)
    hideVolumeTimer = setTimeout(() => useStage.getState().hideVolume(), VOLUME_LABEL_MS)
  }
}

export function Interaction({ rig }: { rig: KeyboardRig }) {
  const tracker = useKeyTracker(rig)
  const knobTravel = useRef(0)

  const startKeyPress = (code: string, event: ThreeEvent<PointerEvent>) => {
    const startX = event.nativeEvent.clientX
    const startY = event.nativeEvent.clientY
    tracker.down(code)

    // A drag that begins on a key becomes an orbit, so the key lets go.
    const finish = () => {
      tracker.up(code)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
    }
    const move = (moved: PointerEvent) => {
      if (Math.hypot(moved.clientX - startX, moved.clientY - startY) > DRAG_CANCEL_PIXELS) finish()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
  }

  const startKnobDrag = (event: ThreeEvent<PointerEvent>) => {
    useStage.getState().setKnobActive(true)
    const { clientX, clientY, offsetX, offsetY } = event.nativeEvent
    let lastX = clientX
    const move = (moved: PointerEvent) => {
      const at = { x: offsetX + moved.clientX - clientX, y: offsetY + moved.clientY - clientY }
      turnKnob(rig, (moved.clientX - lastX) * -KNOB_RADIANS_PER_PIXEL, knobTravel, at)
      lastX = moved.clientX
    }
    const finish = () => {
      useStage.getState().setKnobActive(false)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
  }

  const showPart = (event: ThreeEvent<PointerEvent>) => {
    const label = layerLabel(event)
    if (label) {
      useStage.getState().setHoveredPart({
        label,
        x: event.nativeEvent.offsetX,
        y: event.nativeEvent.offsetY,
      })
    }
  }

  return (
    <primitive
      object={rig.root}
      onPointerDown={(event: ThreeEvent<PointerEvent>) => {
        event.stopPropagation()
        const { mode } = useStage.getState()
        if (mode === 'exploded') {
          showPart(event)
          return
        }
        if (event.object.name === 'knob') {
          startKnobDrag(event)
          return
        }
        const code = keyCodeOf(event)
        if (code) {
          startKeyPress(code, event)
          if (mode === 'test') announceKeyTap(code)
        }
      }}
      onPointerMove={(event: ThreeEvent<PointerEvent>) => {
        event.stopPropagation()
        const stage = useStage.getState()
        if (stage.mode === 'exploded') showPart(event)
        const onKnob = event.object.name === 'knob' && stage.mode !== 'exploded'
        if (onKnob !== stage.knobHovered) stage.setKnobHovered(onKnob)
      }}
      onPointerOut={() => {
        useStage.getState().setHoveredPart(null)
        useStage.getState().setKnobHovered(false)
      }}
      onWheel={(event: ThreeEvent<WheelEvent>) => {
        if (event.object.name !== 'knob' || useStage.getState().mode === 'exploded') return
        event.stopPropagation()
        // Scrolling up turns it clockwise, which is louder.
        const { deltaY, offsetX, offsetY } = event.nativeEvent
        turnKnob(rig, deltaY * 0.004, knobTravel, { x: offsetX, y: offsetY })
      }}
    />
  )
}
