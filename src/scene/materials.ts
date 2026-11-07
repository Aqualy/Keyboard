import { CanvasTexture, Color, Vector2, Vector4 } from 'three'
import {
  abs,
  attribute,
  clamp,
  float,
  fract,
  Fn,
  length,
  mix,
  mx_noise_float,
  positionGeometry,
  select,
  smoothstep,
  texture,
  time,
  uniform,
  uniformArray,
  vec2,
  vec3,
} from 'three/tsl'
import {
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  type Node,
  type Texture,
} from 'three/webgpu'
import type { Layout } from '../data/layout'

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
  /** Stem colour of the compared switch, on the left half while comparing. */
  stemCompare: color(),
  comparing: uniform(0),
  cable: color(),
  connector: uniform(new Color('#cfd0d2')),
  mat: color(),
  keycapRoughness: uniform(0.62),
  /** 1 for textured PBT, 0 for smooth ABS. */
  keycapGrain: uniform(1),
  plateMetalness: uniform(0),
  plateRoughness: uniform(0.5),
  knobMetalness: uniform(1),
  knobRoughness: uniform(0.35),
  shadow: uniform(1),
  /** Index into RGB_EFFECTS. */
  rgbEffect: uniform(0),
  rgbColour: color(),
  /** LED strength. Tweened, so the lights fade on and off. */
  rgbIntensity: uniform(0),
  /** 1 normally, 0 for visitors who ask for less motion, which freezes the effects. */
  rgbSpeed: uniform(1),
  /** Size of the key area in cm, set by each board, so legends and LED patterns fit it. */
  keyArea: uniform(new Vector2(1, 1)),
  /** Seconds on the clock key presses are stamped with, for the reactive effect. */
  ledClock: uniform(0),
  /** 0 to 1 while a typing run's heatmap shows on the keys. */
  heatmap: uniform(0),
}

/** Heatmap colours: the interface's blue for keys pressed, its red for keys missed. */
const HEAT_PRESSED = new Color('#0a3dff')
const HEAT_MISSED = new Color('#d0232b')

/** How many recent presses the reactive effect remembers. Older ones have long faded. */
const PRESS_SLOTS = 8
const NEVER = -1000
const EPOCH = performance.now()
/** The LED clock, which starts with the page so it stays precise in a float. */
export const ledNow = () => (performance.now() - EPOCH) / 1000

/** Recent presses as (x, z in the plate frame, time pressed, unused). */
const presses = Array.from({ length: PRESS_SLOTS }, () => new Vector4(0, 0, NEVER, 0))
const pressNode = uniformArray(presses, 'vec4' as const)
let nextSlot = 0

/** Stamps a key press at its position, so the reactive effect lights it and sends out a ring. */
export function recordPress(x: number, z: number) {
  presses[nextSlot].set(x, z, ledNow(), 0)
  nextSlot = (nextSlot + 1) % PRESS_SLOTS
}

const KEY_AREA = uniforms.keyArea

type Vec2Node = Node<'vec2'>
type FloatNode = Node<'float'>

/** Hue to a fully saturated colour. */
const hue = (h: FloatNode) =>
  clamp(
    abs(
      fract(vec3(h).add(vec3(0, 2 / 3, 1 / 3)))
        .mul(6)
        .sub(3),
    ).sub(1),
    0,
    1,
  )

/** Board position of a point in the plate frame, as 0..1 across the key area. */
const boardUv = (xz: Vec2Node) => xz.div(KEY_AREA).add(0.5)

/** Ring speed of the reactive effect, in cm per second. */
const RING_SPEED = 24

/** Light from recent key presses at a point: the key itself, then a ring running outward. */
const reactive = (xz: Vec2Node) => {
  let light: FloatNode = float(0)
  for (let i = 0; i < PRESS_SLOTS; i += 1) {
    const press = pressNode.element(i)
    const age = uniforms.ledClock.sub(press.z)
    const distance = length(xz.sub(press.xy))
    const key = float(1)
      .sub(smoothstep(0.7, 1.3, distance))
      .mul(clamp(float(1).sub(age.div(0.7)), 0, 1))
    const fade = clamp(float(1).sub(age.div(1.1)), 0, 1)
    const ring = float(1)
      .sub(smoothstep(0, 1.4, abs(distance.sub(age.mul(RING_SPEED)))))
      .mul(fade.mul(fade))
      .mul(0.7)
      // Visitors who ask for less motion get the key without the moving ring.
      .mul(uniforms.rgbSpeed)
    light = light.add(key.max(ring))
  }
  return light.min(1.4)
}

/**
 * LED colour at a point in the plate frame, in cm. Every part samples the same pattern, so a
 * wave runs continuously across caps, switches and plate.
 */
const ledColour = (xz: Vec2Node) => {
  const uv = boardUv(xz)
  const t = time.mul(uniforms.rgbSpeed)
  const aspect = KEY_AREA.x.div(KEY_AREA.y)
  const fromCentre = length(uv.sub(0.5).mul(vec2(aspect, 1)))
  const spectrum = hue(t.mul(0.08))
  const wave = hue(uv.x.sub(t.mul(0.22)))
  const ripple = hue(fromCentre.mul(0.35).sub(t.mul(0.3)))
  const effect = uniforms.rgbEffect
  return select(
    effect.equal(1),
    uniforms.rgbColour,
    select(
      effect.equal(2),
      spectrum,
      select(
        effect.equal(3),
        wave,
        select(effect.equal(4), ripple, uniforms.rgbColour.mul(reactive(xz))),
      ),
    ),
  )
}

const glow = (xz: Vec2Node, strength: number | FloatNode) =>
  ledColour(xz).mul(uniforms.rgbIntensity).mul(strength)

/** A key's heat: x is how often it was pressed (0 to 1), y is 1 if it was missed. */
const heatWeight = () => {
  const heat = attribute('aHeat', 'vec2')
  const weight = select(
    heat.y.greaterThan(0),
    float(1),
    heat.x.mul(0.8).add(0.2).mul(heat.x.sign()),
  )
  return weight.mul(uniforms.heatmap)
}

const heatColour = () => {
  const heat = attribute('aHeat', 'vec2')
  return select(
    heat.y.greaterThan(0),
    vec3(HEAT_MISSED.r, HEAT_MISSED.g, HEAT_MISSED.b),
    vec3(HEAT_PRESSED.r, HEAT_PRESSED.g, HEAT_PRESSED.b),
  )
}

const heated = (base: Node<'vec3'>) => mix(base, heatColour(), heatWeight().mul(0.7))

export function createKeycapMaterial(legends: CanvasTexture) {
  const material = new MeshStandardNodeMaterial({ metalness: 0 })

  // PBT's fine grain breaks up reflections; smooth ABS has none and catches the light.
  const grain = mx_noise_float(positionGeometry.mul(90)).mul(0.12).mul(uniforms.keycapGrain)
  material.roughnessNode = clamp(uniforms.keycapRoughness.add(grain), 0.05, 1)

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
    return mix(heated(printed), vec3(0), occlusion)
  })()

  // Light escapes under the skirt, so only the bottom of each cap glows and keytops stay clean.
  material.emissiveNode = Fn(() => {
    const key = attribute('aKey', 'vec2')
    const skirt = float(1).sub(smoothstep(0, 0.32, positionGeometry.y))
    return glow(key.add(positionGeometry.xz), skirt.mul(0.9)).add(
      heatColour().mul(heatWeight()).mul(0.45),
    )
  })()

  return material
}

/** Switch housings, lit from inside by their LED. */
export function createHousingMaterial(base: Color) {
  const material = new MeshStandardNodeMaterial({ roughness: 0.3, metalness: 0 })
  material.colorNode = vec3(base.r, base.g, base.b)
  material.emissiveNode = Fn(() => {
    const key = attribute('aKey', 'vec2')
    // Brightest at the top, where the light pipe is.
    const height = smoothstep(-0.2, 0.52, positionGeometry.y)
    return glow(key.add(positionGeometry.xz), height.mul(1.4))
  })()
  return material
}

export function createCaseMaterial() {
  const material = new MeshStandardNodeMaterial({ roughness: 0.44, metalness: 0.08 })
  material.colorNode = uniforms.case
  return material
}

/** Depth below the lid seam, in the same S-curve the Blender script cuts. */
const belowSeam = (shape: Layout['case']) => {
  const { depth, frontBottomZ, partingZ, seamEndY, seamStartY, tiltDegrees } = shape
  const y = positionGeometry.z.negate()
  const desk = float(frontBottomZ).sub(
    y.add(depth / 2).mul(Math.tan((tiltDegrees * Math.PI) / 180)),
  )
  const t = clamp(y.sub(seamStartY).div(seamEndY - seamStartY), 0, 1)
  const ease = t
    .mul(t)
    .mul(t)
    .mul(t.mul(t.mul(6).sub(15)).add(10))
  return mix(desk, float(partingZ), ease).sub(positionGeometry.y)
}

export function createLowerLidMaterial(shape: Layout['case']) {
  const material = createCaseMaterial()
  // There are no real-time shadows, so the upper lid's shadow on this part is painted in.
  const shade = smoothstep(0, 0.42, belowSeam(shape)).mul(0.34).add(0.66)
  material.colorNode = uniforms.case.mul(shade)
  return material
}

export function createPlateMaterial() {
  const material = new MeshStandardNodeMaterial()
  material.colorNode = uniforms.plate
  // A faint wash where the LEDs spill onto the plate.
  material.emissiveNode = glow(positionGeometry.xz, 0.12)
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
  material.colorNode = Fn(() => {
    const left = attribute('aKey', 'vec2').x.lessThan(0)
    return select(
      left.and(uniforms.comparing.greaterThan(0.5)),
      uniforms.stemCompare,
      uniforms.stem,
    )
  })()
  return material
}

export function createShadowMaterial(map: Texture) {
  const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false })
  material.colorNode = vec3(0)
  material.opacityNode = float(1).sub(texture(map).r).mul(0.9).mul(uniforms.shadow)
  return material
}
