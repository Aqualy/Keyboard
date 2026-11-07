import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace } from 'three'
import { KEYS, LAYOUT, type KeyDefinition } from '../data/layout'

const PIXELS_PER_UNIT = 256
const FONT = '"Geist Variable", system-ui, sans-serif'

/** Legends are drawn once, so the font has to be ready first. */
export const legendFontReady = () => document.fonts.load(`500 46px ${FONT}`)

function drawKey(context: CanvasRenderingContext2D, key: KeyDefinition) {
  const cx = (key.x / LAYOUT.pitch + LAYOUT.columns / 2) * PIXELS_PER_UNIT
  const cy = (LAYOUT.rows / 2 - key.y / LAYOUT.pitch) * PIXELS_PER_UNIT
  const [first, second] = key.legend

  if (second !== undefined) {
    context.font = `500 38px ${FONT}`
    context.fillText(first, cx, cy - 30)
    context.fillText(second, cx, cy + 30)
    return
  }
  context.font = `500 ${first.length === 1 ? 52 : 32}px ${FONT}`
  context.fillText(first, cx, cy)
}

/** Paints every legend, white on black, across a single whole-board mask. */
export function createLegendTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = LAYOUT.columns * PIXELS_PER_UNIT
  canvas.height = LAYOUT.rows * PIXELS_PER_UNIT
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is not available')

  context.fillStyle = '#000'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#fff'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  for (const key of KEYS) drawKey(context, key)

  const legends = new CanvasTexture(canvas)
  legends.colorSpace = NoColorSpace
  legends.generateMipmaps = true
  legends.minFilter = LinearMipmapLinearFilter
  legends.magFilter = LinearFilter
  legends.anisotropy = 8
  legends.flipY = false
  return legends
}
