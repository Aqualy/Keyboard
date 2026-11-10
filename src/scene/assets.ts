// Starts the board's downloads from the first script, before the 3D code (about 470 KB) arrives.
// Nothing here imports three, so main.tsx can call it at once. src/scene/models.ts parses what lands here.

const base = import.meta.env.BASE_URL
export const assetUrl = (file: string) => `${base}models/${file}`

/** Models every board needs, whatever its size or standard. */
export const SHARED_MODELS = [
  'keycaps-cherry.glb',
  'keycaps-sa.glb',
  'keycaps-xda.glb',
  'switches.glb',
]
export const ENVIRONMENT = 'environment.webp'
export const boardFiles = (layoutId: string) => ({
  model: `${layoutId}.glb`,
  shadow: `shadow-${layoutId}.webp`,
})

const GZIP = [0x1f, 0x8b]

/**
 * The build gzips every model (see `gzipModels` in vite.config.ts), because the host sends .glb files
 * uncompressed. The browser can't know that from the headers, so the bytes are unzipped here.
 * The dev server sends them plain.
 */
async function unzip(response: Response) {
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes[0] !== GZIP[0] || bytes[1] !== GZIP[1]) return bytes.buffer
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).arrayBuffer()
}

const buffers = new Map<string, Promise<ArrayBuffer>>()

/** The model's bytes, downloaded once. A failed download is forgotten, so a remount can retry it. */
export function fetchModel(file: string): Promise<ArrayBuffer> {
  let buffer = buffers.get(file)
  if (!buffer) {
    buffer = fetch(assetUrl(file)).then((response) => {
      if (!response.ok) throw new Error(`Could not load ${file} (${response.status})`)
      return unzip(response)
    })
    // Kept for whoever asks next. This copy only stops an early failure being reported as unhandled.
    buffer.catch(() => buffers.delete(file))
    buffers.set(file, buffer)
  }
  return buffer
}

const images = new Map<string, Promise<HTMLImageElement>>()

export function fetchImage(file: string): Promise<HTMLImageElement> {
  let image = images.get(file)
  if (!image) {
    image = new Promise((resolve, reject) => {
      const element = new Image()
      element.crossOrigin = 'anonymous'
      element.decoding = 'async'
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error(`Could not load ${file}`))
      element.src = assetUrl(file)
    })
    image.catch(() => images.delete(file))
    images.set(file, image)
  }
  return image
}

/** Starts every download the board needs. Safe to call more than once. */
export function prefetchBoard(layoutId: string) {
  const { model, shadow } = boardFiles(layoutId)
  for (const file of [model, ...SHARED_MODELS]) void fetchModel(file)
  for (const file of [shadow, ENVIRONMENT]) void fetchImage(file)
}
