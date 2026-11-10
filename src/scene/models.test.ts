// @vitest-environment node
// jsdom's ArrayBuffer is a different class from Node's, which GLTFLoader rejects.
import { readdirSync, readFileSync } from 'node:fs'
import type { Mesh, Object3D } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { describe, expect, it } from 'vitest'
import { dequantize } from './models'

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
const files = readdirSync('public/models').filter((file) => file.endsWith('.glb'))

async function load(file: string) {
  const bytes = readFileSync(`public/models/${file}`)
  const gltf = await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  )
  dequantize(gltf.scene)
  return gltf
}

describe.each(files)('%s', (file) => {
  it('is compressed with meshopt, not Draco', async () => {
    const { parser } = await load(file)
    expect(parser.json.extensionsUsed).toContain('EXT_meshopt_compression')
    expect(parser.json.extensionsUsed ?? []).not.toContain('KHR_draco_mesh_compression')
  })

  it('turns back into float geometry with the original node transforms', async () => {
    const { scene } = await load(file)
    const nodes: Object3D[] = []
    const meshes: Mesh[] = []
    scene.traverse((object) => {
      if (object.userData.trs) nodes.push(object)
      if ((object as Mesh).isMesh) meshes.push(object as Mesh)
    })
    expect(nodes.length).toBeGreaterThan(0)
    expect(meshes.length).toBeGreaterThan(0)
    for (const node of nodes) {
      const [translation, , scale] = node.userData.trs as number[][]
      expect(node.position.toArray()).toEqual(translation.map((v) => expect.closeTo(v, 5)))
      expect(node.scale.toArray()).toEqual(scale.map((v) => expect.closeTo(v, 5)))
    }
    const attributes = meshes.flatMap((mesh) => Object.values(mesh.geometry.attributes))
    for (const attribute of attributes) {
      expect(attribute.array).toBeInstanceOf(Float32Array)
      expect(attribute.normalized).toBe(false)
    }
  })
})

it('keeps the knob in its slot and the shadow plane textured', async () => {
  const { scene } = await load('65-ansi.glb')
  const knob = scene.getObjectByName('knob')!
  // The knob sits in the top-right key slot, above Del.
  expect(knob.position.x).toBeCloseTo(14.2875, 3)
  expect(knob.scale.toArray()).toEqual([1, 1, 1])
  const shadow = scene.getObjectByName('shadowPlane') as Mesh
  // The app puts the shadow texture on it, so its UVs must survive compression.
  expect(shadow.geometry.getAttribute('uv')).toBeDefined()
  // The scale moved back into the geometry: the case is its full width again, not a unit cube.
  const lid = scene.getObjectByName('upperLid') as Mesh
  lid.geometry.computeBoundingBox()
  const box = lid.geometry.boundingBox!
  expect(box.max.x - box.min.x).toBeGreaterThan(30)
})
