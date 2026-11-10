import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, use, useEffect, useLayoutEffect, useMemo } from 'react'
import { WebGPURenderer } from 'three/webgpu'
import { LAYOUTS, type Layout } from '../data/layout'
import { layoutOf, useConfig } from '../state/config'
import { useStage } from '../state/stage'
import { STAGE_CAMERA } from './camera'
import { CameraRig } from './CameraRig'
import { ConfigSync } from './ConfigSync'
import { Interaction } from './Interaction'
import { Lighting } from './Lighting'
import { KeyboardRig } from './KeyboardRig'
import { arrangementFor } from './layers'
import { createLegendTexture, legendFontReady, repaintLegends } from './legends'
import { loadBoard } from './models'
import { usesSymbols } from '../data/keysets'

const fontReady = legendFontReady()

/** Once the first board shows, the others load in idle time, so changing size or standard is instant. */
function preloadOtherBoards() {
  const idle = window.requestIdleCallback ?? ((callback: () => void) => setTimeout(callback, 200))
  for (const layout of LAYOUTS) idle(() => void loadBoard(layout.id).catch(() => undefined))
}

function Keyboard({ layout }: { layout: Layout }) {
  use(fontReady)
  const { keyboard, keycaps, switchModel, shadow, environment } = use(loadBoard(layout.id))
  const scene = useThree((state) => state.scene)

  const legends = useMemo(() => {
    const { config } = useConfig.getState()
    return createLegendTexture(layout, config.region, usesSymbols(config.keyset))
  }, [layout])
  const rig = useMemo(
    () =>
      new KeyboardRig({
        layout,
        keyboard,
        keycaps,
        switchModel,
        shadow,
        legends,
      }),
    [layout, keyboard, keycaps, switchModel, shadow, legends],
  )

  // The LEDs are on the PCB, so parts lifted off it in the exploded view stop glowing.
  useFrame(() => rig.updateLedReach())

  useEffect(
    () =>
      useConfig.subscribe((state, previous) => {
        const symbols = usesSymbols(state.config.keyset)
        if (
          state.config.region !== previous.config.region ||
          symbols !== usesSymbols(previous.config.keyset)
        ) {
          repaintLegends(legends, layout, state.config.region, symbols)
        }
      }),
    [legends, layout],
  )

  // Set before the first frame: a frame drawn without it compiled every material twice, once without
  // reflections and once with them, which doubled the first visit's shader compile time.
  useLayoutEffect(() => {
    scene.environment = environment
  }, [environment, scene])

  useEffect(() => {
    rig.reveal()
    useStage.getState().setReady()
    preloadOtherBoards()
  }, [rig])

  useEffect(() => {
    const { mode, section, heatmap } = useStage.getState()
    rig.arrange(arrangementFor(mode, section))
    rig.showHeat(heatmap)
    return useStage.subscribe((state, previous) => {
      if (state.mode !== previous.mode || state.section !== previous.section) {
        rig.arrange(arrangementFor(state.mode, state.section))
      }
      if (state.heatmap !== previous.heatmap) rig.showHeat(state.heatmap)
    })
  }, [rig])

  return (
    <>
      <Interaction rig={rig} />
      <ConfigSync rig={rig} />
      <Lighting />
    </>
  )
}

/** One board at a time. A new size or standard swaps in its own model. */
function CurrentKeyboard() {
  const layout = useConfig((state) => layoutOf(state.config))
  return <Keyboard key={layout.id} layout={layout} />
}

export function Stage() {
  return (
    <Canvas
      flat
      dpr={[1, 2]}
      camera={STAGE_CAMERA}
      gl={async (props) => {
        const renderer = new WebGPURenderer({
          ...(props as ConstructorParameters<typeof WebGPURenderer>[0]),
          antialias: true,
          alpha: true,
        })
        await renderer.init()
        return renderer as never
      }}
    >
      <Suspense fallback={null}>
        <CurrentKeyboard />
      </Suspense>
      <CameraRig />
    </Canvas>
  )
}
