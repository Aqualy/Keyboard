import { Canvas, useLoader, useThree } from '@react-three/fiber'
import { Suspense, use, useEffect, useMemo } from 'react'
import { EquirectangularReflectionMapping, SRGBColorSpace, TextureLoader } from 'three'
import { WebGPURenderer } from 'three/webgpu'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
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

const base = import.meta.env.BASE_URL
const model = (file: string) => `${base}models/${file}`

const draco = new DRACOLoader()
const withDraco = (loader: GLTFLoader) => {
  loader.setDRACOLoader(draco)
}
const fontReady = legendFontReady()

const SHARED_MODELS = ['keycaps-cherry.glb', 'keycaps-sa.glb', 'keycaps-xda.glb', 'switch.glb']

// Every board is small, so all of them load up front and changing size or standard is instant.
useLoader.preload(
  GLTFLoader,
  LAYOUTS.map((layout) => model(`${layout.id}.glb`)),
  withDraco,
)
useLoader.preload(
  TextureLoader,
  LAYOUTS.map((layout) => model(`shadow-${layout.id}.webp`)),
)

function Keyboard({ layout }: { layout: Layout }) {
  use(fontReady)
  const [keyboard, cherry, sa, xda, switchModel] = useLoader(
    GLTFLoader,
    [`${layout.id}.glb`, ...SHARED_MODELS].map(model),
    withDraco,
  )
  const [shadow, environment] = useLoader(TextureLoader, [
    model(`shadow-${layout.id}.webp`),
    model('environment.webp'),
  ])
  const scene = useThree((state) => state.scene)

  const legends = useMemo(
    () => createLegendTexture(layout, useConfig.getState().config.region),
    [layout],
  )
  const rig = useMemo(
    () =>
      new KeyboardRig({
        layout,
        keyboard,
        keycaps: { cherry, sa, xda },
        switchModel,
        shadow,
        legends,
      }),
    [layout, keyboard, cherry, sa, xda, switchModel, shadow, legends],
  )

  useEffect(
    () =>
      useConfig.subscribe((state, previous) => {
        if (state.config.region !== previous.config.region) {
          repaintLegends(legends, layout, state.config.region)
        }
      }),
    [legends, layout],
  )

  useEffect(() => {
    environment.mapping = EquirectangularReflectionMapping
    environment.colorSpace = SRGBColorSpace
    scene.environment = environment
    rig.reveal()
    useStage.getState().setReady()
  }, [environment, scene, rig])

  useEffect(() => {
    const { mode, section } = useStage.getState()
    rig.arrange(arrangementFor(mode, section))
    return useStage.subscribe((state, previous) => {
      if (state.mode !== previous.mode || state.section !== previous.section) {
        rig.arrange(arrangementFor(state.mode, state.section))
      }
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
