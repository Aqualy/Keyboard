import { CanvasTexture, Color } from 'three'
import {
  attribute,
  clamp,
  float,
  Fn,
  mix,
  positionGeometry,
  texture,
  uniform,
  vec2,
  vec3,
} from 'three/tsl'
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial, type Texture } from 'three/webgpu'
import { LAYOUT } from '../data/layout'

const color = () => uniform(new Color('#ffffff'))

/** Shared by every material, so a colour change is one tween and never a rebuild. */
export const uniforms = {
  case: color(),
  alpha: color(),
  mod: color(),
  accent: color(),
  legend: color(),
  plate: color(),
  knob: color(),
  stem: color(),
  plateMetalness: uniform(0),
  plateRoughness: uniform(0.5),
  knobMetalness: uniform(1),
  knobRoughness: uniform(0.35),
  shadow: uniform(1),
}

const KEY_AREA = vec2(LAYOUT.columns * LAYOUT.pitch, LAYOUT.rows * LAYOUT.pitch)

export function createKeycapMaterial(legends: CanvasTexture) {
  const material = new MeshStandardNodeMaterial({ roughness: 0.56, metalness: 0 })

  material.colorNode = Fn(() => {
    const zone = attribute('aZone', 'vec3')
    const key = attribute('aKey', 'vec2')
    const base = uniforms.alpha
      .mul(zone.x)
      .add(uniforms.mod.mul(zone.y))
      .add(uniforms.accent.mul(zone.z))

    // One whole-board mask projected from above, so every cap finds its own legend.
    const uv = key.add(positionGeometry.xz).div(KEY_AREA).add(0.5)
    const ink = texture(legends, uv).r
    const printed = mix(base, uniforms.legend, ink)

    // No shadows between keys, so depth comes from darkening each cap's lower wall.
    const occlusion = float(1)
      .sub(clamp(positionGeometry.y.div(0.7), 0, 1))
      .mul(0.2)
    return mix(printed, vec3(0), occlusion)
  })()

  return material
}

export function createCaseMaterial() {
  const material = new MeshStandardNodeMaterial({ roughness: 0.44, metalness: 0.08 })
  material.colorNode = uniforms.case
  return material
}

export function createPlateMaterial() {
  const material = new MeshStandardNodeMaterial()
  material.colorNode = uniforms.plate
  material.metalnessNode = uniforms.plateMetalness
  material.roughnessNode = uniforms.plateRoughness
  return material
}

export function createKnobMaterial() {
  const material = new MeshStandardNodeMaterial()
  material.colorNode = uniforms.knob
  material.metalnessNode = uniforms.knobMetalness
  material.roughnessNode = uniforms.knobRoughness
  return material
}

export function createStemMaterial() {
  const material = new MeshStandardNodeMaterial({ roughness: 0.32, metalness: 0 })
  material.colorNode = uniforms.stem
  return material
}

export function createShadowMaterial(map: Texture) {
  const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false })
  material.colorNode = vec3(0)
  material.opacityNode = float(1).sub(texture(map).r).mul(0.9).mul(uniforms.shadow)
  return material
}
