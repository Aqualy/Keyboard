import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace } from 'three'
import { withLegends, type KeyDefinition, type Layout } from '../data/layout'
import type { RegionId } from '../data/regions'

const PIXELS_PER_UNIT = 256
const FONT = '"Geist Variable", system-ui, sans-serif'

/** Legends are drawn once, so the font has to be ready first. */
export const legendFontReady = () => document.fonts.load(`500 46px ${FONT}`)

function drawKey(context: CanvasRenderingContext2D, layout: Layout, key: KeyDefinition) {
  const { x, y } = key.legendAt ?? key
  const cx = (x / layout.pitch + layout.columns / 2) * PIXELS_PER_UNIT
  const cy = (layout.rows / 2 - y / layout.pitch) * PIXELS_PER_UNIT
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
function paint(canvas: HTMLCanvasElement, layout: Layout, region: RegionId) {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is not available')
  context.fillStyle = '#000'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#fff'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  for (const key of withLegends(layout, region)) drawKey(context, layout, key)
}

export function createLegendTexture(layout: Layout, region: RegionId) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(layout.columns * PIXELS_PER_UNIT)
  canvas.height = Math.round(layout.rows * PIXELS_PER_UNIT)
  paint(canvas, layout, region)

  const legends = new CanvasTexture(canvas)
  legends.colorSpace = NoColorSpace
  legends.generateMipmaps = true
  legends.minFilter = LinearMipmapLinearFilter
  legends.magFilter = LinearFilter
  legends.anisotropy = 8
  legends.flipY = false
  return legends
}

/** Reprints the legends for another region on the same board. */
export function repaintLegends(legends: CanvasTexture, layout: Layout, region: RegionId) {
  paint(legends.image as HTMLCanvasElement, layout, region)
  legends.needsUpdate = true
}
