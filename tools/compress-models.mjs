// Compresses glTF models with meshopt (EXT_meshopt_compression + KHR_mesh_quantization).
// Usage: node tools/compress-models.mjs [file.glb ...]   (default: every .glb in public/models)
//
// Meshopt files are smaller than Draco ones and decode synchronously with a 29 KB decoder bundled into the
// app, so the browser no longer downloads a 280 KB Draco decoder after the first model arrives.
// Quantization moves a scale and offset onto each mesh's node. The app reads geometry without node
// transforms, so every node keeps its original transform in `extras.trs`; `dequantize` in
// src/scene/models.ts bakes the difference back into the geometry. Draco input is accepted, so old files
// convert in place.
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, meshopt, prune } from '@gltf-transform/functions'
import draco3d from 'draco3dgltf'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const modelsDir = join(dirname(fileURLToPath(import.meta.url)), '../public/models')

await MeshoptEncoder.ready
await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'meshopt.encoder': MeshoptEncoder,
  'meshopt.decoder': MeshoptDecoder,
})

export async function compressModel(file) {
  const before = statSync(file).size
  const document = await io.read(file)
  const root = document.getRoot()
  // Already compressed: decompressing and re-quantizing would only add error.
  if (root.listExtensionsUsed().some((e) => e.extensionName === 'EXT_meshopt_compression')) {
    console.log(`${file}: already meshopt, skipped`)
    return
  }
  for (const extension of root.listExtensionsUsed()) {
    if (extension.extensionName === 'KHR_draco_mesh_compression') extension.dispose()
  }
  for (const node of root.listNodes()) {
    node.setExtras({
      ...node.getExtras(),
      trs: [node.getTranslation(), node.getRotation(), node.getScale()],
    })
  }
  await document.transform(
    dedup(),
    // The app textures some parts itself (the shadow plane), so UVs stay even without a texture here.
    prune({ keepAttributes: true }),
    meshopt({
      encoder: MeshoptEncoder,
      level: 'high',
      // 14 bits over a 32 cm case is 0.02 mm; normals at 10 bits match the old Draco export.
      quantizePosition: 14,
      quantizeNormal: 10,
      quantizeTexcoord: 12,
    }),
  )
  await io.write(file, document)
  const after = statSync(file).size
  console.log(`${file}: ${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = process.argv.slice(2).length
    ? process.argv.slice(2)
    : readdirSync(modelsDir)
        .filter((name) => name.endsWith('.glb'))
        .map((name) => join(modelsDir, name))
  for (const file of files) {
    readFileSync(file) // fail early on a missing file
    await compressModel(file)
  }
}
