import { Canvas, useLoader, useThree } from '@react-three/fiber'
import { Suspense, use, useEffect, useMemo } from 'react'
import { EquirectangularReflectionMapping, SRGBColorSpace, TextureLoader } from 'three'
import { WebGPURenderer } from 'three/webgpu'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { useStage } from '../state/stage'
import { STAGE_CAMERA } from './camera'
import { CameraRig } from './CameraRig'
import { ConfigSync } from './ConfigSync'
import { Interaction } from './Interaction'
import { Lighting } from './Lighting'
import { KeyboardRig } from './KeyboardRig'
import { arrangementFor } from './layers'
import { createLegendTexture, legendFontReady } from './legends'

const base = import.meta.env.BASE_URL
const model = (file: string) => `${base}models/${file}`

const draco = new DRACOLoader()
const withDraco = (loader: GLTFLoader) => {
  loader.setDRACOLoader(draco)
}
const fontReady = legendFontReady()

function Keyboard() {
  use(fontReady)
  const [keyboard, cherry, sa, xda, switchModel] = useLoader(
    GLTFLoader,
    ['gmk67.glb', 'keycaps-cherry.glb', 'keycaps-sa.glb', 'keycaps-xda.glb', 'switch.glb'].map(
      model,
    ),
    withDraco,
  )
  const [shadow, environment] = useLoader(TextureLoader, [
    model('shadow.webp'),
    model('environment.webp'),
  ])
  const scene = useThree((state) => state.scene)

  const rig = useMemo(
    () =>
      new KeyboardRig({
        keyboard,
        keycaps: { cherry, sa, xda },
        switchModel,
        shadow,
        legends: createLegendTexture(),
      }),
    [keyboard, cherry, sa, xda, switchModel, shadow],
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
        <Keyboard />
      </Suspense>
      <CameraRig />
    </Canvas>
  )
}
