import { CanvasTexture, Color, Vector2, Vector4 } from 'three'
import {
  abs,
  attribute,
  clamp,
  float,
  fract,
  Fn,
  length,
  luminance,
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
  MeshPhysicalNodeMaterial,
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
  switchTop: color(),
  switchTopOpacity: uniform(1),
  switchTopCompare: color(),
  switchTopOpacityCompare: uniform(1),
  switchBottom: color(),
  switchBottomOpacity: uniform(1),
  switchBottomCompare: color(),
  switchBottomOpacityCompare: uniform(1),
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
  /**
   * How much LED light reaches each part, 1 seated on the PCB and 0 once lifted away. The light
   * comes only from the LEDs on the PCB, so parts pulled off the board go dark.
   */
  ledReachKeycaps: uniform(1),
  ledReachSwitches: uniform(1),
  ledReachPlate: uniform(1),
  /**
   * How much the keycaps shade each part, 1 with the caps seated over it and 0 once they are
   * lifted clear. Real caps keep the plate and switch tops in shadow between the keys.
   */
  capShadeSwitches: uniform(1),
  capShadePlate: uniform(1),
  /** Seconds on the clock key presses are stamped with, for the reactive effect. */
  ledClock: uniform(0),
  /** 0 to 1 while a typing run's heatmap shows on the keys. */
  heatmap: uniform(0),
}

/**
 * How much light reaches a part in the keycaps' shadow, under dark and under light keycaps. A gap
 * shouldn't look brighter than the caps around it, so dark caps cast the deeper shade. Reflections
 * of the room are what made a glossy plate shine through, so they drop the most. LED glow is not
 * affected.
 */
const UNDER_CAPS = {
  colour: { dark: 0.3, light: 0.6 },
  reflection: { dark: 0.3, light: 0.45 },
}

/** Puts a part in the keycaps' shadow, darkening its colour and what it reflects. */
function shadeUnderCaps(
  material: MeshStandardNodeMaterial,
  base: Node<'vec3'> | Node<'color'>,
  cover: Node<'float'>,
) {
  const lightness = luminance(uniforms.alpha)
  const light = (range: { dark: number; light: number }) =>
    mix(float(1), mix(float(range.dark), float(range.light), lightness), cover)
  material.colorNode = base.mul(light(UNDER_CAPS.colour))
  material.aoNode = light(UNDER_CAPS.reflection)
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
    // A clear housing spreads the LED's light all round the cap. A solid one lets it out only
    // through its window, so less escapes, and mostly on the north side above the LED.
    const solidity = select(
      comparedHalf(),
      uniforms.switchTopOpacityCompare,
      uniforms.switchTopOpacity,
    )
    const north = smoothstep(0.3, -0.7, positionGeometry.z)
    const spread = mix(float(1), north.mul(0.75).add(0.1), solidity)
    const light = skirt.mul(0.9).mul(spread).mul(uniforms.ledReachKeycaps)
    return glow(key.add(positionGeometry.xz), light).add(heatColour().mul(heatWeight()).mul(0.45))
  })()

  return material
}

/** True on the left half of the board while two switches are compared there. */
const comparedHalf = () =>
  attribute('aKey', 'vec2').x.lessThan(0).and(uniforms.comparing.greaterThan(0.5))

/**
 * A switch housing half. Clear and smoky housings are see-through, showing the stem and spring,
 * and the top half carries the LED's light up through its window.
 */
export function createSwitchShellMaterial(part: 'top' | 'bottom') {
  const [own, ownOpacity, compared, comparedOpacity] =
    part === 'top'
      ? [
          uniforms.switchTop,
          uniforms.switchTopOpacity,
          uniforms.switchTopCompare,
          uniforms.switchTopOpacityCompare,
        ]
      : [
          uniforms.switchBottom,
          uniforms.switchBottomOpacity,
          uniforms.switchBottomCompare,
          uniforms.switchBottomOpacityCompare,
        ]
  // Polycarbonate refracts like glass rather than fading out: light bends through it, its
  // edges catch highlights, and the flat faces stay clear. Solid nylon and POM let none through.
  const material = new MeshPhysicalNodeMaterial({ metalness: 0, ior: 1.58, thickness: 0.12 })
  const solidity = Fn(() => select(comparedHalf(), comparedOpacity, ownOpacity))()
  shadeUnderCaps(
    material,
    Fn(() => select(comparedHalf(), compared, own))(),
    uniforms.capShadeSwitches,
  )
  material.transmissionNode = float(1).sub(solidity)
  material.roughnessNode = mix(float(0.04), float(0.38), solidity)
  material.specularIntensityNode = float(1)
  if (part === 'top') {
    material.emissiveNode = Fn(() => {
      const key = attribute('aKey', 'vec2')
      // The LED sits on the PCB just north of the stem. A clear housing carries its light all
      // over; a solid one lets it out only through the window above it.
      const ledWindow = smoothstep(-0.34, -0.44, positionGeometry.z).mul(
        smoothstep(0.24, 0.44, positionGeometry.y),
      )
      const through = mix(float(1), ledWindow, solidity)
      return glow(key.add(positionGeometry.xz), through.mul(1.4).mul(uniforms.ledReachSwitches))
    })()
  }
  return material
}

/** The per-key LED: a small white package on the PCB that lights in the effect's colour. */
export function createLedMaterial() {
  const material = new MeshStandardNodeMaterial({ roughness: 0.4, metalness: 0 })
  shadeUnderCaps(material, vec3(0.92, 0.92, 0.9), uniforms.capShadeSwitches)
  material.emissiveNode = Fn(() => {
    const key = attribute('aKey', 'vec2')
    return glow(key.add(positionGeometry.xz), 3)
  })()
  return material
}

/** Springs, contact leaves, click bars and pins. */
export function createSwitchMetalMaterial() {
  const material = new MeshStandardNodeMaterial({ roughness: 0.3, metalness: 1 })
  shadeUnderCaps(material, vec3(0.8, 0.8, 0.82), uniforms.capShadeSwitches)
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
  shadeUnderCaps(material, uniforms.plate, uniforms.capShadePlate)
  // A faint wash where the LEDs spill onto the plate.
  material.emissiveNode = glow(positionGeometry.xz, uniforms.ledReachPlate.mul(0.12))
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
  material.colorNode = Fn(() => select(comparedHalf(), uniforms.stemCompare, uniforms.stem))()
  return material
}

export function createShadowMaterial(map: Texture) {
  const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false })
  material.colorNode = vec3(0)
  material.opacityNode = float(1).sub(texture(map).r).mul(0.9).mul(uniforms.shadow)
  return material
}
