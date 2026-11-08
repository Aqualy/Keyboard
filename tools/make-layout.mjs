// Generates src/data/layouts/<size>-<standard>.json, the single source of truth for key geometry.
// Each file is shared by the Blender model script and the app. Run: node tools/make-layout.mjs
import { mkdirSync, writeFileSync } from 'node:fs'

const pitch = 1.905
const round = (n) => Number(n.toFixed(4))

const key = (code, legend, width = 1, zone = 'alpha') => ({ code, legend, width, zone })
const mod = (code, label, width = 1) => key(code, [label], width, 'mod')
const accent = (code, label, width = 1) => key(code, [label], width, 'accent')
const letters = (chars) => [...chars].map((c) => key(`Key${c}`, [c]))
const fKeys = (from, to) =>
  Array.from({ length: to - from + 1 }, (_, i) => mod(`F${from + i}`, `F${from + i}`))
const gap = (width) => ({ gap: width })
/** The top of an ISO Enter. Its lower part fills a gap in the row below. */
const isoEnterTop = () => ({ ...accent('Enter', 'Enter', 1.5), isoEnter: true })

// Legends here are the US (ANSI) and UK (ISO) sets. Other regions override them in the app.
const numberRow = (escape) => [
  escape,
  key('Digit1', ['!', '1']),
  key('Digit2', ['@', '2']),
  key('Digit3', ['#', '3']),
  key('Digit4', ['$', '4']),
  key('Digit5', ['%', '5']),
  key('Digit6', ['^', '6']),
  key('Digit7', ['&', '7']),
  key('Digit8', ['*', '8']),
  key('Digit9', ['(', '9']),
  key('Digit0', [')', '0']),
  key('Minus', ['_', '-']),
  key('Equal', ['+', '=']),
  mod('Backspace', 'Backspace', 2),
]

const tabRow = (iso) => [
  mod('Tab', 'Tab', 1.5),
  ...letters('QWERTYUIOP'),
  key('BracketLeft', ['{', '[']),
  key('BracketRight', ['}', ']']),
  iso ? isoEnterTop() : key('Backslash', ['|', '\\'], 1.5),
]

const capsRow = (iso) => [
  mod('CapsLock', 'Caps Lock', 1.75),
  ...letters('ASDFGHJKL'),
  key('Semicolon', [':', ';']),
  key('Quote', ['"', "'"]),
  // ISO's extra key sits left of Enter. Browsers report it as Backslash.
  ...(iso ? [key('Backslash', ['~', '#']), gap(1.25)] : [accent('Enter', 'Enter', 2.25)]),
]

const shiftRow = (iso, rightShift) => [
  ...(iso
    ? [mod('ShiftLeft', 'Shift', 1.25), key('IntlBackslash', ['|', '\\'])]
    : [mod('ShiftLeft', 'Shift', 2.25)]),
  ...letters('ZXCVBNM'),
  key('Comma', ['<', ',']),
  key('Period', ['>', '.']),
  key('Slash', ['?', '/']),
  mod('ShiftRight', 'Shift', rightShift),
]

/**
 * Each size lists its rows top to bottom. `top` is the row's distance from the top of the key
 * area in units, so a function row can sit apart from the rest. `profile` is the sculpted row.
 */
const SIZES = {
  65: {
    name: 'GMK67',
    columns: 16,
    depth: 5,
    knob: { column: 15, row: 0 },
    indicator: { column: 12.25, row: 4 },
    rows: (iso) => [
      { top: 0, profile: 0, keys: numberRow(accent('Escape', 'Esc')) },
      { top: 1, profile: 1, keys: [...tabRow(iso), mod('Delete', 'Del')] },
      { top: 2, profile: 2, keys: [...capsRow(iso), mod('PageUp', 'PgUp')] },
      {
        top: 3,
        profile: 3,
        keys: [...shiftRow(iso, 1.75), mod('ArrowUp', '↑'), mod('PageDown', 'PgDn')],
      },
      {
        top: 4,
        profile: 4,
        keys: [
          mod('ControlLeft', 'Ctrl', 1.25),
          mod('MetaLeft', 'Win', 1.25),
          mod('AltLeft', 'Alt', 1.25),
          key('Space', [''], 6.25),
          mod('AltRight', 'Alt', 1.25),
          mod('Fn', 'Fn', 1.25),
          gap(0.5),
          mod('ArrowLeft', '←'),
          mod('ArrowDown', '↓'),
          mod('ArrowRight', '→'),
        ],
      },
    ],
  },
  75: {
    name: 'GMK 75%',
    columns: 16,
    depth: 6.25,
    knob: { column: 15, row: 0 },
    indicator: null,
    rows: (iso) => [
      {
        top: 0,
        profile: 0,
        keys: [
          accent('Escape', 'Esc'),
          ...fKeys(1, 12),
          mod('PrintScreen', 'PrtSc'),
          mod('Delete', 'Del'),
        ],
      },
      {
        top: 1.25,
        profile: 0,
        keys: [...numberRow(key('Backquote', ['~', '`'])), mod('Home', 'Home')],
      },
      { top: 2.25, profile: 1, keys: [...tabRow(iso), mod('PageUp', 'PgUp')] },
      { top: 3.25, profile: 2, keys: [...capsRow(iso), mod('PageDown', 'PgDn')] },
      {
        top: 4.25,
        profile: 3,
        keys: [...shiftRow(iso, 1.75), mod('ArrowUp', '↑'), mod('End', 'End')],
      },
      {
        top: 5.25,
        profile: 4,
        keys: [
          mod('ControlLeft', 'Ctrl', 1.25),
          mod('MetaLeft', 'Win', 1.25),
          mod('AltLeft', 'Alt', 1.25),
          key('Space', [''], 6.25),
          mod('AltRight', 'Alt'),
          mod('Fn', 'Fn'),
          mod('ControlRight', 'Ctrl'),
          mod('ArrowLeft', '←'),
          mod('ArrowDown', '↓'),
          mod('ArrowRight', '→'),
        ],
      },
    ],
  },
  tkl: {
    name: 'GMK TKL',
    columns: 18.25,
    depth: 6.5,
    knob: { column: 17.75 - 0.5, row: 0 },
    // The indicator is a tab of the case reaching in from the front wall, and a TKL's full
    // bottom row leaves it no way through.
    indicator: null,
    rows: (iso) => [
      {
        top: 0,
        profile: 0,
        keys: [
          accent('Escape', 'Esc'),
          gap(1),
          ...fKeys(1, 4),
          gap(0.5),
          ...fKeys(5, 8),
          gap(0.5),
          ...fKeys(9, 12),
          gap(0.25),
          mod('PrintScreen', 'PrtSc'),
          mod('ScrollLock', 'ScrLk'),
        ],
      },
      {
        top: 1.5,
        profile: 0,
        keys: [
          ...numberRow(key('Backquote', ['~', '`'])),
          gap(0.25),
          mod('Insert', 'Ins'),
          mod('Home', 'Home'),
          mod('PageUp', 'PgUp'),
        ],
      },
      {
        top: 2.5,
        profile: 1,
        keys: [
          ...tabRow(iso),
          gap(0.25),
          mod('Delete', 'Del'),
          mod('End', 'End'),
          mod('PageDown', 'PgDn'),
        ],
      },
      { top: 3.5, profile: 2, keys: capsRow(iso) },
      {
        top: 4.5,
        profile: 3,
        keys: [...shiftRow(iso, 2.75), gap(1.25), mod('ArrowUp', '↑')],
      },
      {
        top: 5.5,
        profile: 4,
        keys: [
          mod('ControlLeft', 'Ctrl', 1.25),
          mod('MetaLeft', 'Win', 1.25),
          mod('AltLeft', 'Alt', 1.25),
          key('Space', [''], 6.25),
          mod('AltRight', 'Alt', 1.25),
          mod('MetaRight', 'Win', 1.25),
          mod('ContextMenu', 'Menu', 1.25),
          mod('ControlRight', 'Ctrl', 1.25),
          gap(0.25),
          mod('ArrowLeft', '←'),
          mod('ArrowDown', '↓'),
          mod('ArrowRight', '→'),
        ],
      },
    ],
  },
}

const homing = new Set(['KeyF', 'KeyJ'])

function buildKeys(size, iso) {
  const { columns, depth } = size
  // Toward the back of the board is positive, matching Blender's Y axis.
  const toX = (units) => round((units - columns / 2) * pitch)
  const toY = (top) => round((depth / 2 - top) * pitch)
  const rows = size.rows(iso)
  return rows.flatMap((row, rowIndex) => {
    let cursor = 0
    return row.keys.flatMap((item) => {
      if ('gap' in item) {
        cursor += item.gap
        return []
      }
      const left = cursor
      cursor += item.width
      const base = {
        ...item,
        row: row.profile,
        x: toX(left + item.width / 2),
        y: toY(row.top + 0.5),
        stabilized: item.width >= 2,
        homing: homing.has(item.code),
      }
      if (!item.isoEnter) return [base]
      // The ISO Enter spans this row and the next. Its switch sits in the middle of the 1.25u
      // lower part, on the line between the two rows; its legend stays on the upper part.
      const { isoEnter, ...rest } = base
      void isoEnter
      const below = rows[rowIndex + 1]
      return [
        {
          ...rest,
          shape: 'isoEnter',
          stabilized: false,
          x: toX(cursor - 0.625),
          y: toY((row.top + 0.5 + below.top + 0.5) / 2),
          legendAt: { x: base.x, y: base.y },
        },
      ]
    })
  })
}

/** Case and PCB screws sit in the gaps between switch holes. */
function freeSpot(keys, target) {
  const clearance = (x, y) =>
    Math.min(...keys.map((k) => Math.max(Math.abs(k.x - x), Math.abs(k.y - y)) - 0.7))
  let best = target
  let bestScore = -Infinity
  for (let dx = -1.2; dx <= 1.2; dx += 0.05) {
    for (let dy = -1.2; dy <= 1.2; dy += 0.05) {
      const x = target[0] + dx
      const y = target[1] + dy
      const room = clearance(x, y)
      if (room < 0.22) continue
      const score = -Math.hypot(dx, dy)
      if (score > bestScore) {
        bestScore = score
        best = [round(x), round(y)]
      }
    }
  }
  return best
}

/** The 65% board's screws, measured from the real board, scaled to other sizes. */
const GMK67_SCREWS = [
  [-12.5, 2.0],
  [-12.5, -2.9],
  [12.4, 2.05],
  [12.4, -2.9],
  [-1.0, -3.8],
  [0.9, 2.86],
]

mkdirSync('src/data/layouts', { recursive: true })

for (const [sizeId, size] of Object.entries(SIZES)) {
  for (const standard of ['ansi', 'iso']) {
    const keys = buildKeys(size, standard === 'iso')
    const width = round(size.columns * pitch + 2.02)
    const depth = round(size.depth * pitch + 2.125)
    const sx = width / 32.5
    const sy = depth / 11.65
    const is65 = sizeId === '65'
    const cell = (column, row) => ({
      x: round((column + 0.5 - size.columns / 2) * pitch),
      y: round((size.depth / 2 - size.rows(false)[row].top - 0.5) * pitch),
    })
    const layout = {
      id: `${sizeId}-${standard}`,
      size: sizeId,
      standard,
      name: size.name,
      pitch,
      columns: size.columns,
      rows: size.depth,
      // The key well leaves a raised pad in one corner. The knob takes the key slot there.
      knob: { ...cell(size.knob.column, size.knob.row), radius: 0.8, wellMargin: 0.04 },
      // Keycap skirt height above the plate. Set a little low, so the caps sit snug in the case.
      keycapBaseZ: 0.44,
      indicator: size.indicator
        ? {
            ...cell(size.indicator.column, size.indicator.row),
            width: 0.72,
            depth: 1.8,
          }
        : null,
      // All in centimetres, in the plate's coordinate frame (plate top is z = 0).
      case: {
        width,
        depth,
        cornerRadius: 0.5,
        topZ: 0.55,
        partingZ: -0.3,
        frontBottomZ: -1.25,
        tiltDegrees: 5.2,
        // Where the lid seam leaves the desk and where it levels out along the side.
        seamStartY: is65 ? -2 : round(-2 * sy),
        seamEndY: is65 ? 4.4 : round(4.4 * sy),
      },
      screws: is65 ? GMK67_SCREWS : GMK67_SCREWS.map(([x, y]) => freeSpot(keys, [x * sx, y * sy])),
      keys,
    }
    writeFileSync(`src/data/layouts/${layout.id}.json`, `${JSON.stringify(layout, null, 2)}\n`)
  }
}
