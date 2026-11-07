import gsap from 'gsap'
import {
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
import { KEYS, keycapMeshName, LAYOUT, type KeyDefinition } from '../data/layout'
import { motion } from '../motion'
import type { ProfileId } from '../data/options'
import {
  createCaseMaterial,
  createKeycapMaterial,
  createKnobMaterial,
  createLowerLidMaterial,
  createPlateMaterial,
  createShadowMaterial,
  createStemMaterial,
  uniforms,
} from './materials'

export const TILT = (LAYOUT.case.tiltDegrees * Math.PI) / 180
const DESK_OFFSET =
  (-LAYOUT.case.frontBottomZ + (LAYOUT.case.depth / 2) * Math.tan(TILT)) * Math.cos(TILT)
/** Lifts the case off the desk, as its rubber feet do. */
const FOOT_HEIGHT = 0.02
/** Height of the keycap base above the plate. */
const CAP_HEIGHT = LAYOUT.keycapBaseZ
const PRESS_SECONDS = 0.07
const FLEX_SECONDS = 0.4
const FLEX_DEPTH = 0.06

const ZONE_WEIGHTS = { alpha: [1, 0, 0], mod: [0, 1, 0], accent: [0, 0, 1] } as const

/** Stacked in the order of the GMK67 assembly diagram, top first. */
export const LAYERS = [
  { id: 'keycaps', label: 'Keycaps', lift: 19, parts: [] },
  { id: 'switches', label: 'Switches', lift: 15.5, parts: [] },
  { id: 'knob', label: 'Multimedia knob', lift: 13, parts: ['knob'] },
  { id: 'upperLid', label: 'Upper lid', lift: 10.5, parts: ['upperLid'] },
  {
    id: 'plate',
    label: 'Positioning plate',
    lift: 8,
    parts: [
      'plate',
      'stabilizers',
      'stabilizerWires',
      'ledIndicator',
      'ledIndicatorFace',
      'ledIndicatorLights',
    ],
  },
  { id: 'plateFoam', label: 'Plate foam', lift: 6.2, parts: ['plateFoam'] },
  { id: 'pcbFoam', label: 'PCB foam', lift: 4.6, parts: ['pcbFoam'] },
  { id: 'pcb', label: 'PCB', lift: 3, parts: ['pcb', 'screws'] },
  { id: 'foamBase', label: 'Foam base', lift: 1.2, parts: ['foamBase'] },
  {
    id: 'lowerLid',
    label: 'Lower lid',
    lift: 0,
    parts: ['lowerLid', 'gasketStrips', 'feet', 'rearDark', 'rearLight'],
  },
] as const

export type LayerId = (typeof LAYERS)[number]['id']

interface InstanceSlot {
  mesh: InstancedMesh
  index: number
  baseY: number
}

interface KeyState {
  key: KeyDefinition
  press: number
  caps: Record<ProfileId, InstanceSlot>
  stem: InstanceSlot
}

export interface RigAssets {
  keyboard: GLTF
  keycaps: Record<ProfileId, GLTF>
  switchModel: GLTF
  shadow: Texture
  legends: CanvasTexture
}

const matrix = new Matrix4()

function place(slot: InstanceSlot, key: KeyDefinition, drop: number) {
  // Blender's Y points to the back of the board, which is three.js's -Z.
  matrix.makeTranslation(key.x, slot.baseY - drop, -key.y)
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
  knob: Object3D | undefined
  travel = 0.4
  private readonly flex = new Group()
  private readonly capSets = new Map<ProfileId, Group>()
  private readonly keys = new Map<string, KeyState>()
  private activeProfile: ProfileId = 'cherry'
  private exploded = false

  constructor(assets: RigAssets) {
    const { keyboard, keycaps, switchModel, shadow, legends } = assets
    // Parts move into layers below, so work on a copy of the loader's cached scene.
    const nodes = keyboard.scene.clone()

    this.tilted.position.y = DESK_OFFSET + FOOT_HEIGHT
    this.tilted.rotation.x = TILT
    this.root.add(this.tilted)

    const caseMaterial = createCaseMaterial()
    const plateMaterial = createPlateMaterial()
    const knobMaterial = createKnobMaterial()
    const overrides: Record<string, Material> = {
      upperLid: caseMaterial,
      lowerLid: createLowerLidMaterial(),
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
        if (!mesh) throw new Error(`Model is missing part: ${part}`)
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

    const stems = this.buildSwitches(switchModel)
    this.buildKeycaps(keycaps, legends, stems)
  }

  private buildSwitches(model: GLTF) {
    const layer = this.layers.get('switches')!
    const housingNode = model.scene.getObjectByName('housing') as Mesh
    const stemNode = model.scene.getObjectByName('stem') as Mesh
    const housings = instanced(housingNode.geometry, housingNode.material, KEYS, 'housings')
    const stems = instanced(stemNode.geometry, createStemMaterial(), KEYS, 'stems')
    KEYS.forEach((key, index) => {
      place({ mesh: housings, index, baseY: 0 }, key, 0)
      place({ mesh: stems, index, baseY: 0 }, key, 0)
    })
    layer.add(housings, stems)
    return stems
  }

  private buildKeycaps(
    keycaps: RigAssets['keycaps'],
    legends: CanvasTexture,
    stems: InstancedMesh,
  ) {
    const material = createKeycapMaterial(legends)
    const slots = new Map<string, Partial<Record<ProfileId, InstanceSlot>>>()

    for (const profile of Object.keys(keycaps) as ProfileId[]) {
      const set = new Group()
      set.name = `keycaps-${profile}`
      this.capSets.set(profile, set)

      for (const [meshName, keys] of groupByShape(KEYS)) {
        const node = keycaps[profile].scene.getObjectByName(meshName) as Mesh | undefined
        if (!node) throw new Error(`Keycaps are missing shape: ${meshName}`)

        const geometry = node.geometry.clone()
        const zones = new Float32Array(keys.flatMap((key) => [...ZONE_WEIGHTS[key.zone]]))
        const centres = new Float32Array(keys.flatMap((key) => [key.x, -key.y]))
        geometry.setAttribute('aZone', new InstancedBufferAttribute(zones, 3))
        geometry.setAttribute('aKey', new InstancedBufferAttribute(centres, 2))

        const mesh = instanced(geometry, material, keys, meshName)
        keys.forEach((key, index) => {
          const slot = { mesh, index, baseY: CAP_HEIGHT }
          place(slot, key, 0)
          slots.set(key.code, { ...slots.get(key.code), [profile]: slot })
        })
        set.add(mesh)
      }
    }

    KEYS.forEach((key, index) => {
      this.keys.set(key.code, {
        key,
        press: 0,
        caps: slots.get(key.code) as Record<ProfileId, InstanceSlot>,
        stem: { mesh: stems, index, baseY: 0 },
      })
    })
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
    const rest = this.exploded ? this.liftOf('keycaps') : 0
    gsap.killTweensOf(layer.position)
    gsap
      .timeline()
      .to(layer.position, { y: rest + 1.6, duration: motion(0.16), ease: 'power2.out' })
      .call(() => this.setProfile(profile))
      .to(layer.position, { y: rest, duration: motion(0.42), ease: 'bounce.out' })
  }

  setExploded(exploded: boolean) {
    this.exploded = exploded
    const duration = motion(exploded ? 1.1 : 0.9)
    const ease = 'power3.inOut'
    LAYERS.forEach((layer, index) => {
      gsap.to(this.layers.get(layer.id)!.position, {
        y: exploded ? layer.lift : 0,
        duration,
        ease,
        delay: motion(index * 0.03),
        overwrite: true,
      })
    })
    gsap.to(this.tilted.rotation, { x: exploded ? 0 : TILT, duration, ease, overwrite: true })
    gsap.to(uniforms.shadow, { value: exploded ? 0.45 : 1, duration, overwrite: true })
  }

  private liftOf(id: LayerId) {
    return LAYERS.find((layer) => layer.id === id)?.lift ?? 0
  }

  /** Eases the board in once it has loaded. */
  reveal() {
    const duration = motion(1.5)
    gsap.fromTo(this.root.position, { y: 1.4 }, { y: 0, duration, ease: 'power3.out' })
    gsap.fromTo(uniforms.shadow, { value: 0 }, { value: 1, duration, ease: 'power2.out' })
  }

  rotateKnob(radians: number) {
    if (this.knob) this.knob.rotation.y += radians
  }

  press(code: string) {
    this.animateKey(code, this.travel)
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
        place(state.stem, state.key, state.press)
      },
    })
  }
}
