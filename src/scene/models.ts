import {
  BufferAttribute,
  type BufferGeometry,
  EquirectangularReflectionMapping,
  type InterleavedBufferAttribute,
  Matrix4,
  type Mesh,
  type Object3D,
  Quaternion,
  SRGBColorSpace,
  Texture,
  Vector3,
} from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { boardFiles, ENVIRONMENT, fetchImage, fetchModel, SHARED_MODELS } from './assets'

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)

type TRS = [[number, number, number], [number, number, number, number], [number, number, number]]

type Attribute = BufferAttribute | InterleavedBufferAttribute

const COMPONENTS = ['getX', 'getY', 'getZ', 'getW'] as const

/** Quantized attributes are padded to 4-byte strides, so three loads them interleaved. */
function toFloat(attribute: Attribute) {
  const { count, itemSize } = attribute
  const array = new Float32Array(count * itemSize)
  for (let i = 0; i < count; i++) {
    for (let c = 0; c < itemSize; c++) array[i * itemSize + c] = attribute[COMPONENTS[c]](i)
  }
  return new BufferAttribute(array, itemSize)
}

const isQuantized = (attribute: Attribute) =>
  attribute.normalized ||
  'isInterleavedBufferAttribute' in attribute ||
  !(attribute.array instanceof Float32Array)

/**
 * Meshopt models store positions as small integers, with a scale and offset on each node
 * (tools/compress-models.mjs). The rig reads geometry without node transforms, so this turns the
 * attributes back into floats, moves that scale and offset into the geometry and restores the node's
 * original transform from `extras.trs`. Geometry shared by two nodes is only baked once.
 */
export function dequantize(root: Object3D) {
  const done = new WeakSet<BufferGeometry>()
  const original = new Matrix4()
  const delta = new Matrix4()

  const bake = (geometry: BufferGeometry, matrix: Matrix4 | null) => {
    if (done.has(geometry)) return
    done.add(geometry)
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      if (isQuantized(attribute)) {
        geometry.setAttribute(name, toFloat(attribute))
      }
    }
    if (matrix) geometry.applyMatrix4(matrix)
  }

  root.traverse((object) => {
    const trs = object.userData.trs as TRS | undefined
    const mesh = object as Mesh
    if (trs) {
      const [t, r, s] = trs
      original.compose(new Vector3(...t), new Quaternion(...r), new Vector3(...s))
      object.updateMatrix()
      delta.copy(original).invert().multiply(object.matrix)
      // A node with several primitives is a group whose meshes carry no transform of their own.
      const parts = mesh.isMesh
        ? [mesh]
        : (object.children as Mesh[]).filter((child) => child.isMesh && !child.userData.trs)
      for (const part of parts) bake(part.geometry, delta)
      original.decompose(object.position, object.quaternion, object.scale)
      object.updateMatrix()
    } else if (mesh.isMesh && !done.has(mesh.geometry)) {
      // A mesh node made by the compressor itself (its parent had children), with identity as original.
      mesh.updateMatrix()
      bake(mesh.geometry, mesh.matrix.clone())
      mesh.position.set(0, 0, 0)
      mesh.quaternion.identity()
      mesh.scale.set(1, 1, 1)
      mesh.updateMatrix()
    }
  })
}

const gltfs = new Map<string, Promise<GLTF>>()

export function loadModel(file: string): Promise<GLTF> {
  let gltf = gltfs.get(file)
  if (!gltf) {
    gltf = fetchModel(file)
      .then((buffer) => loader.parseAsync(buffer, ''))
      .then((model) => {
        dequantize(model.scene)
        return model
      })
    gltf.catch(() => gltfs.delete(file))
    gltfs.set(file, gltf)
  }
  return gltf
}

const textures = new Map<string, Promise<Texture>>()

function loadTexture(file: string, setup?: (texture: Texture) => void): Promise<Texture> {
  let texture = textures.get(file)
  if (!texture) {
    texture = fetchImage(file).then((image) => {
      const result = new Texture(image)
      setup?.(result)
      result.needsUpdate = true
      return result
    })
    texture.catch(() => textures.delete(file))
    textures.set(file, texture)
  }
  return texture
}

export interface BoardAssets {
  keyboard: GLTF
  keycaps: { cherry: GLTF; sa: GLTF; xda: GLTF }
  switchModel: GLTF
  shadow: Texture
  environment: Texture
}

const boards = new Map<string, Promise<BoardAssets>>()

/** Everything one board needs, as one promise that stays the same, so React's `use` can wait on it. */
export function loadBoard(layoutId: string): Promise<BoardAssets> {
  let board = boards.get(layoutId)
  if (!board) {
    const { model, shadow } = boardFiles(layoutId)
    board = Promise.all([
      loadModel(model),
      ...SHARED_MODELS.map(loadModel),
      loadTexture(shadow),
      loadTexture(ENVIRONMENT, (texture) => {
        texture.mapping = EquirectangularReflectionMapping
        texture.colorSpace = SRGBColorSpace
      }),
    ]).then(([keyboard, cherry, sa, xda, switchModel, shadowTexture, environment]) => ({
      keyboard: keyboard as GLTF,
      keycaps: { cherry: cherry as GLTF, sa: sa as GLTF, xda: xda as GLTF },
      switchModel: switchModel as GLTF,
      shadow: shadowTexture as Texture,
      environment: environment as Texture,
    }))
    board.catch(() => boards.delete(layoutId))
    boards.set(layoutId, board)
  }
  return board
}
