import gsap from 'gsap'
import {
  BoxGeometry,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  type BufferGeometry,
  type CanvasTexture,
  type Material,
  type Mesh,
  type Object3D,
  type Texture,
} from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { keycapMeshName, type KeyDefinition, type Layout } from '../data/layout'
import { motion } from '../motion'
import {
  byId,
  SWITCH_MODELS,
  SWITCHES,
  type ProfileId,
  type SwitchId,
  type SwitchModel,
} from '../data/options'
import { switchForKey } from '../state/stage'
import type { KeyHeat } from '../test/typing'
import { Desk, portPosition } from './desk'
import { LAYERS, liftsFor, staggerOrder, type Arrangement, type LayerId } from './layers'
import {
  createCaseMaterial,
  createKeycapMaterial,
  createKnobMaterial,
  createLedMaterial,
  createLowerLidMaterial,
  createPlateMaterial,
  createShadowMaterial,
  createStemMaterial,
  createSwitchMetalMaterial,
  createSwitchShellMaterial,
  recordPress,
  uniforms,
} from './materials'

/** Lifts the case off the desk, as its rubber feet do. */
const FOOT_HEIGHT = 0.02
/** Parts only some boards have. */
const OPTIONAL_PARTS = new Set(['ledIndicator', 'ledIndicatorFace', 'ledIndicatorLights'])
const PRESS_SECONDS = 0.07
/** Delay between neighbouring layers when the board spreads or assembles. */
const STAGGER_SECONDS = 0.03
const FLEX_SECONDS = 0.4
const FLEX_DEPTH = 0.06
/** How far north of the switch centre the LED sits, 5.08 mm as on MX footprints. */
const LED_NORTH = 0.508
/** Lifted further than this from the PCB, a part no longer catches any LED light. */
const LED_REACH = 2
/** Once the keycaps are this far above a part, their shadow no longer reaches it. */
const CAP_SHADOW_REACH = 2

const ZONE_WEIGHTS = { alpha: [1, 0, 0], mod: [0, 1, 0], accent: [0, 0, 1] } as const

interface InstanceSlot {
  mesh: InstancedMesh
  index: number
  baseY: number
  /** Collapsed to nothing, for parts of switch designs a key isn't using. */
  hidden?: boolean
}

const SWITCH_PARTS = ['top', 'bottom', 'stem', 'metal'] as const
type SwitchPart = (typeof SWITCH_PARTS)[number]

interface SwitchSlot {
  design: SwitchModel
  /** Stems travel with the key; housings and metal stay put. */
  moves: boolean
  slot: InstanceSlot
}

interface KeyState {
  key: KeyDefinition
  press: number
  /** How far this key travels, which differs between compared switches. */
  travel: number
  caps: Record<ProfileId, InstanceSlot>
  switchParts: SwitchSlot[]
}

export interface RigAssets {
  layout: Layout
  keyboard: GLTF
  keycaps: Record<ProfileId, GLTF>
  switchModel: GLTF
  shadow: Texture
  legends: CanvasTexture
}

const matrix = new Matrix4()

function place(slot: InstanceSlot, key: KeyDefinition, drop: number) {
  if (slot.hidden) matrix.makeScale(0, 0, 0)
  // Blender's Y points to the back of the board, which is three.js's -Z.
  else matrix.makeTranslation(key.x, slot.baseY - drop, -key.y)
  slot.mesh.setMatrixAt(slot.index, matrix)
  slot.mesh.instanceMatrix.needsUpdate = true
}

function instanced(
  geometry: BufferGeometry,
  material: Material | Material[],
  keys: KeyDefinition[],
  name: string,
) {
  const mesh = new InstancedMesh(geometry, material, keys.length)
  mesh.name = name
  mesh.frustumCulled = false
  mesh.userData.codes = keys.map((key) => key.code)
  return mesh
}

function groupByShape(keys: KeyDefinition[]) {
  const groups = new Map<string, KeyDefinition[]>()
  for (const key of keys) {
    const name = keycapMeshName(key)
    groups.set(name, [...(groups.get(name) ?? []), key])
  }
  return groups
}

export class KeyboardRig {
  readonly root = new Group()
  readonly tilted = new Group()
  readonly shadow: Mesh
  readonly layers = new Map<LayerId, Group>()
  readonly desk: Desk
  knob: Object3D | undefined
  travel = 0.4
  private readonly flex = new Group()
  private readonly capSets = new Map<ProfileId, Group>()
  private readonly keys = new Map<string, KeyState>()
  private activeProfile: ProfileId = 'cherry'
  private lifts = liftsFor('assembled')
  private readonly tilt: number
  private readonly layout: Layout

  constructor(assets: RigAssets) {
    const { layout, keyboard, keycaps, switchModel, shadow, legends } = assets
    this.layout = layout
    // Parts move into layers below, so work on a copy of the loader's cached scene.
    const nodes = keyboard.scene.clone()

    const shape = layout.case
    this.tilt = (shape.tiltDegrees * Math.PI) / 180
    // Raises the tilted plate frame so the case's underside rests on the desk.
    const deskOffset =
      (-shape.frontBottomZ + (shape.depth / 2) * Math.tan(this.tilt)) * Math.cos(this.tilt)
    this.tilted.position.y = deskOffset + FOOT_HEIGHT
    this.tilted.rotation.x = this.tilt
    uniforms.keyArea.value.set(layout.columns * layout.pitch, layout.rows * layout.pitch)
    this.root.add(this.tilted)

    const caseMaterial = createCaseMaterial()
    const plateMaterial = createPlateMaterial()
    const knobMaterial = createKnobMaterial()
    const overrides: Record<string, Material> = {
      upperLid: caseMaterial,
      lowerLid: createLowerLidMaterial(shape),
      rearLight: caseMaterial,
      ledIndicator: caseMaterial,
      plate: plateMaterial,
      knob: knobMaterial,
    }

    const flexing = new Set<LayerId>([
      'keycaps',
      'switches',
      'plate',
      'plateFoam',
      'pcbFoam',
      'pcb',
      'foamBase',
    ])
    this.tilted.add(this.flex)

    for (const layer of LAYERS) {
      const group = new Group()
      group.name = layer.id
      group.userData.layer = layer.id
      this.layers.set(layer.id, group)
      ;(flexing.has(layer.id) ? this.flex : this.tilted).add(group)
      for (const part of layer.parts) {
        const mesh = nodes.getObjectByName(part)
        if (!mesh) {
          if (OPTIONAL_PARTS.has(part)) continue
          throw new Error(`Model is missing part: ${part}`)
        }
        const material = overrides[part]
        if (material) {
          // A part with several material slots loads as a group of meshes.
          mesh.traverse((child) => {
            if ((child as Mesh).isMesh) (child as Mesh).material = material
          })
        }
        group.add(mesh)
      }
    }
    this.knob = this.layers.get('knob')?.children[0]

    const shadowPlane = nodes.getObjectByName('shadowPlane') as Mesh | undefined
    if (!shadowPlane) throw new Error('Model is missing part: shadowPlane')
    shadow.flipY = false
    shadowPlane.material = createShadowMaterial(shadow)
    shadowPlane.position.y = 0
    this.shadow = shadowPlane
    this.root.add(shadowPlane)

    this.root.updateMatrixWorld(true)
    this.desk = new Desk(layout, this.tilted.localToWorld(portPosition(layout)))
    this.root.add(this.desk.group)

    this.buildLeds()
    const switchParts = this.buildSwitches(switchModel)
    this.buildKeycaps(keycaps, legends, switchParts)
  }

  /**
   * One RGB LED per key, soldered to the PCB 5 mm north of the switch's centre, as on a real
   * per-key RGB board. All of the board's light starts here.
   */
  private buildLeds() {
    const keys = this.layout.keys
    const geometry = new BoxGeometry(0.35, 0.1, 0.28)
    // In the plate frame the PCB's top is at -0.5, and north is -z.
    geometry.translate(0, -0.45, -LED_NORTH)
    geometry.setAttribute(
      'aKey',
      new InstancedBufferAttribute(new Float32Array(keys.flatMap((key) => [key.x, -key.y])), 2),
    )
    const leds = instanced(geometry, createLedMaterial(), keys, 'leds')
    keys.forEach((key, index) => place({ mesh: leds, index, baseY: 0 }, key, 0))
    this.layers.get('pcb')!.add(leds)
  }

  /**
   * Dims each part's glow by how far it has been lifted off the LEDs, and its lit colour by how
   * close the keycaps are above it. Call every frame.
   */
  updateLedReach() {
    const pcb = this.layers.get('pcb')!.position.y
    const reach = (layer: LayerId) => {
      const gap = this.layers.get(layer)!.position.y - pcb
      const near = Math.min(1, Math.max(0, 1 - gap / LED_REACH))
      return near * near
    }
    uniforms.ledReachKeycaps.value = reach('keycaps')
    uniforms.ledReachSwitches.value = reach('switches')
    uniforms.ledReachPlate.value = reach('plate')

    const keycaps = this.layers.get('keycaps')!.position.y
    const shade = (layer: LayerId) => {
      const gap = keycaps - this.layers.get(layer)!.position.y
      return Math.min(1, Math.max(0, 1 - gap / CAP_SHADOW_REACH))
    }
    uniforms.capShadeSwitches.value = shade('switches')
    uniforms.capShadePlate.value = shade('plate')
  }

  /**
   * Builds every switch design for every key, each hidden until chosen. Changing switch, or
   * comparing two of different designs, then only moves instances, with nothing to rebuild.
   */
  private buildSwitches(model: GLTF) {
    const layer = this.layers.get('switches')!
    const keys = this.layout.keys
    const centres = new Float32Array(keys.flatMap((key) => [key.x, -key.y]))
    const materials: Record<SwitchPart, Material> = {
      top: createSwitchShellMaterial('top'),
      bottom: createSwitchShellMaterial('bottom'),
      stem: createStemMaterial(),
      metal: createSwitchMetalMaterial(),
    }
    const parts = new Map<string, SwitchSlot[]>(keys.map((key) => [key.code, []]))
    for (const design of SWITCH_MODELS) {
      for (const part of SWITCH_PARTS) {
        const node = model.scene.getObjectByName(`${design}_${part}`) as Mesh | undefined
        // Not every design has every part: the buckling spring has no separate metal.
        if (!node) continue
        const geometry = node.geometry.clone()
        geometry.setAttribute('aKey', new InstancedBufferAttribute(centres, 2))
        const mesh = instanced(geometry, materials[part], keys, `switch-${design}-${part}`)
        keys.forEach((key, index) => {
          const slot = { mesh, index, baseY: 0, hidden: true }
          place(slot, key, 0)
          parts.get(key.code)!.push({ design, moves: part === 'stem', slot })
        })
        layer.add(mesh)
      }
    }
    return parts
  }

  private buildKeycaps(
    keycaps: RigAssets['keycaps'],
    legends: CanvasTexture,
    switchParts: Map<string, SwitchSlot[]>,
  ) {
    const material = createKeycapMaterial(legends)
    const slots = new Map<string, Partial<Record<ProfileId, InstanceSlot>>>()

    for (const profile of Object.keys(keycaps) as ProfileId[]) {
      const set = new Group()
      set.name = `keycaps-${profile}`
      this.capSets.set(profile, set)

      for (const [meshName, keys] of groupByShape(this.layout.keys)) {
        const node = keycaps[profile].scene.getObjectByName(meshName) as Mesh | undefined
        if (!node) throw new Error(`Keycaps are missing shape: ${meshName}`)

        const geometry = node.geometry.clone()
        const zones = new Float32Array(keys.flatMap((key) => [...ZONE_WEIGHTS[key.zone]]))
        const centres = new Float32Array(keys.flatMap((key) => [key.x, -key.y]))
        geometry.setAttribute('aZone', new InstancedBufferAttribute(zones, 3))
        geometry.setAttribute('aKey', new InstancedBufferAttribute(centres, 2))
        geometry.setAttribute(
          'aHeat',
          new InstancedBufferAttribute(new Float32Array(keys.length * 2), 2),
        )

        const mesh = instanced(geometry, material, keys, meshName)
        keys.forEach((key, index) => {
          const slot = { mesh, index, baseY: this.layout.keycapBaseZ }
          place(slot, key, 0)
          slots.set(key.code, { ...slots.get(key.code), [profile]: slot })
        })
        set.add(mesh)
      }
    }

    for (const key of this.layout.keys) {
      this.keys.set(key.code, {
        key,
        press: 0,
        travel: this.travel,
        caps: slots.get(key.code) as Record<ProfileId, InstanceSlot>,
        switchParts: switchParts.get(key.code)!,
      })
    }
    this.layers.get('keycaps')!.add(this.capSets.get(this.activeProfile)!)
  }

  setProfile(profile: ProfileId) {
    const layer = this.layers.get('keycaps')!
    layer.remove(this.capSets.get(this.activeProfile)!)
    layer.add(this.capSets.get(profile)!)
    this.activeProfile = profile
    for (const state of this.keys.values()) place(state.caps[profile], state.key, state.press)
  }

  /** Lifts the caps, swaps them at the top of the arc, and settles the new set. */
  changeProfile(profile: ProfileId) {
    if (profile === this.activeProfile) return
    const layer = this.layers.get('keycaps')!
    const rest = this.lifts.get('keycaps') ?? 0
    gsap.killTweensOf(layer.position)
    gsap
      .timeline()
      .to(layer.position, { y: rest + 1.6, duration: motion(0.16), ease: 'power2.out' })
      .call(() => this.setProfile(profile))
      .to(layer.position, { y: rest, duration: motion(0.42), ease: 'bounce.out' })
  }

  /** Moves the layers into place. Any spread lays the board flat so the gaps read clearly. */
  arrange(arrangement: Arrangement) {
    const spread = arrangement !== 'assembled'
    this.lifts = liftsFor(arrangement)
    const duration = motion(spread ? 1.1 : 0.9)
    const ease = 'power3.inOut'
    LAYERS.forEach((layer, index) => {
      const position = this.layers.get(layer.id)!.position
      const target = this.lifts.get(layer.id)!
      const order = staggerOrder(index, position.y, target)
      gsap.to(position, {
        y: target,
        duration,
        ease,
        delay: motion(order * STAGGER_SECONDS),
        overwrite: true,
      })
    })
    gsap.to(this.tilted.rotation, { x: spread ? 0 : this.tilt, duration, ease, overwrite: true })
    gsap.to(uniforms.shadow, { value: spread ? 0.45 : 1, duration, overwrite: true })
    this.desk.unplug(spread)
  }

  /** Eases the board in once it has loaded. */
  reveal() {
    const duration = motion(1.5)
    gsap.fromTo(this.root.position, { y: 1.4 }, { y: 0, duration, ease: 'power3.out' })
    gsap.fromTo(uniforms.shadow, { value: 0 }, { value: 1, duration, ease: 'power2.out' })
  }

  /**
   * Shows each key's switch: the chosen one, or while comparing, the compared one on the left
   * half. Each half also travels as far as its own switch does.
   */
  setSwitches(chosen: SwitchId, compare: SwitchId | null) {
    for (const state of this.keys.values()) {
      const option = byId(SWITCHES, switchForKey(state.key.x, chosen, compare))
      state.travel = option.travel
      for (const part of state.switchParts) {
        part.slot.hidden = part.design !== option.model
        place(part.slot, state.key, part.moves ? state.press : 0)
      }
    }
  }

  /** Shows a typing run on the keys, or fades it away when there is none. */
  showHeat(heat: Record<string, KeyHeat> | null) {
    if (heat) {
      const most = Math.max(1, ...Object.values(heat).map((entry) => entry.presses))
      for (const state of this.keys.values()) {
        const entry = heat[state.key.code]
        for (const slot of Object.values(state.caps)) {
          const attribute = slot.mesh.geometry.getAttribute('aHeat') as InstancedBufferAttribute
          attribute.setXY(slot.index, (entry?.presses ?? 0) / most, entry?.misses ? 1 : 0)
          attribute.needsUpdate = true
        }
      }
    }
    gsap.to(uniforms.heatmap, {
      value: heat ? 1 : 0,
      duration: motion(heat ? 0.9 : 0.4),
      ease: 'power2.out',
      overwrite: true,
    })
  }

  rotateKnob(radians: number) {
    if (this.knob) this.knob.rotation.y += radians
  }

  press(code: string) {
    const state = this.keys.get(code)
    if (state) recordPress(state.key.x, -state.key.y)
    this.animateKey(code, state?.travel ?? this.travel)
    gsap.to(this.flex.position, {
      y: -FLEX_DEPTH,
      duration: FLEX_SECONDS,
      ease: 'power3.out',
      overwrite: true,
    })
  }

  release(code: string) {
    this.animateKey(code, 0)
    gsap.to(this.flex.position, {
      y: 0,
      duration: FLEX_SECONDS,
      ease: 'power3.out',
      overwrite: true,
    })
  }

  private animateKey(code: string, depth: number) {
    const state = this.keys.get(code)
    if (!state) return
    gsap.to(state, {
      press: depth,
      duration: motion(PRESS_SECONDS),
      ease: 'power1.out',
      overwrite: true,
      onUpdate: () => {
        place(state.caps[this.activeProfile], state.key, state.press)
        for (const part of state.switchParts) {
          if (part.moves) place(part.slot, state.key, state.press)
        }
      },
    })
  }
}
