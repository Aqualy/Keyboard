import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace } from 'three'
import { withLegends, type KeyDefinition, type Layout } from '../data/layout'
import type { RegionId } from '../data/regions'

const PIXELS_PER_UNIT = 256
const FONT = '"Geist Variable", system-ui, sans-serif'

/** Legends are drawn once, so the font has to be ready first. */
export const legendFontReady = () => document.fonts.load(`500 46px ${FONT}`)

type Context = CanvasRenderingContext2D

/** An arrow head at (x, y) pointing along (dx, dy), drawn as two strokes. */
function arrowHead(context: Context, x: number, y: number, dx: number, dy: number) {
  const size = 14
  context.moveTo(x - dx * size - dy * size, y - dy * size + dx * size)
  context.lineTo(x, y)
  context.lineTo(x - dx * size + dy * size, y - dy * size - dx * size)
}

/** A hollow upward arrow, the shape behind Shift and Caps Lock. */
function hollowArrow(context: Context, cx: number, top: number) {
  context.moveTo(cx, top)
  context.lineTo(cx + 22, top + 22)
  context.lineTo(cx + 10, top + 22)
  context.lineTo(cx + 10, top + 44)
  context.lineTo(cx - 10, top + 44)
  context.lineTo(cx - 10, top + 22)
  context.lineTo(cx - 22, top + 22)
  context.closePath()
}

/**
 * The standard keyboard symbols for the big modifiers, as keycap sets print them in place of
 * words. Keys not listed keep their word.
 */
const SYMBOLS: Record<string, (context: Context, cx: number, cy: number) => void> = {
  Backspace: (context, cx, cy) => {
    context.moveTo(cx + 34, cy)
    context.lineTo(cx - 34, cy)
    arrowHead(context, cx - 34, cy, -1, 0)
  },
  Tab: (context, cx, cy) => {
    context.moveTo(cx - 32, cy)
    context.lineTo(cx + 28, cy)
    arrowHead(context, cx + 28, cy, 1, 0)
    context.moveTo(cx + 32, cy - 16)
    context.lineTo(cx + 32, cy + 16)
  },
  CapsLock: (context, cx, cy) => {
    hollowArrow(context, cx, cy - 32)
    context.moveTo(cx - 10, cy + 24)
    context.lineTo(cx + 10, cy + 24)
  },
  ShiftLeft: (context, cx, cy) => hollowArrow(context, cx, cy - 22),
  ShiftRight: (context, cx, cy) => hollowArrow(context, cx, cy - 22),
  Enter: (context, cx, cy) => {
    context.moveTo(cx + 26, cy - 24)
    context.lineTo(cx + 26, cy + 8)
    context.lineTo(cx - 28, cy + 8)
    arrowHead(context, cx - 28, cy + 8, -1, 0)
  },
}

function drawSymbol(context: Context, code: string, cx: number, cy: number) {
  const symbol = SYMBOLS[code]
  if (!symbol) return false
  context.save()
  context.strokeStyle = '#fff'
  context.lineWidth = 5
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.beginPath()
  symbol(context, cx, cy)
  context.stroke()
  context.restore()
  return true
}

function drawKey(context: Context, layout: Layout, key: KeyDefinition, symbols: boolean) {
  const { x, y } = key.legendAt ?? key
  const cx = (x / layout.pitch + layout.columns / 2) * PIXELS_PER_UNIT
  const cy = (layout.rows / 2 - y / layout.pitch) * PIXELS_PER_UNIT
  if (symbols && drawSymbol(context, key.code, cx, cy)) return
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
function paint(canvas: HTMLCanvasElement, layout: Layout, region: RegionId, symbols: boolean) {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is not available')
  context.fillStyle = '#000'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#fff'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  for (const key of withLegends(layout, region)) drawKey(context, layout, key, symbols)
}

export function createLegendTexture(layout: Layout, region: RegionId, symbols: boolean) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(layout.columns * PIXELS_PER_UNIT)
  canvas.height = Math.round(layout.rows * PIXELS_PER_UNIT)
  paint(canvas, layout, region, symbols)

  const legends = new CanvasTexture(canvas)
  legends.colorSpace = NoColorSpace
  legends.generateMipmaps = true
  legends.minFilter = LinearMipmapLinearFilter
  legends.magFilter = LinearFilter
  legends.anisotropy = 8
  legends.flipY = false
  return legends
}

/** Reprints the legends for another region, or with or without symbols, on the same board. */
export function repaintLegends(
  legends: CanvasTexture,
  layout: Layout,
  region: RegionId,
  symbols: boolean,
) {
  paint(legends.image as HTMLCanvasElement, layout, region, symbols)
  legends.needsUpdate = true
}
