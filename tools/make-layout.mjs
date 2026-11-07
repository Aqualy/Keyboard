// Generates src/data/layout.gmk67.json, the single source of truth for key geometry.
// It is shared by the Blender model script and the app.
import { writeFileSync } from 'node:fs'

const key = (code, legend, width = 1, zone = 'alpha') => ({ code, legend, width, zone })
const mod = (code, label, width = 1) => key(code, [label], width, 'mod')
const accent = (code, label, width = 1) => key(code, [label], width, 'accent')
const letters = (chars) => [...chars].map((c) => key(`Key${c}`, [c]))
const gap = (width) => ({ gap: width })

const rows = [
  [
    accent('Escape', 'Esc'),
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
  ],
  [
    mod('Tab', 'Tab', 1.5),
    ...letters('QWERTYUIOP'),
    key('BracketLeft', ['{', '[']),
    key('BracketRight', ['}', ']']),
    key('Backslash', ['|', '\\'], 1.5),
    mod('Delete', 'Del'),
  ],
  [
    mod('CapsLock', 'Caps Lock', 1.75),
    ...letters('ASDFGHJKL'),
    key('Semicolon', [':', ';']),
    key('Quote', ['"', "'"]),
    accent('Enter', 'Enter', 2.25),
    mod('PageUp', 'PgUp'),
  ],
  [
    mod('ShiftLeft', 'Shift', 2.25),
    ...letters('ZXCVBNM'),
    key('Comma', ['<', ',']),
    key('Period', ['>', '.']),
    key('Slash', ['?', '/']),
    mod('ShiftRight', 'Shift', 1.75),
    mod('ArrowUp', '↑'),
    mod('PageDown', 'PgDn'),
  ],
  [
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
]

const stabilized = new Set(['Backspace', 'Enter', 'ShiftLeft', 'Space'])
const homing = new Set(['KeyF', 'KeyJ'])
const pitch = 1.905
const columns = 16
const round = (n) => Number(n.toFixed(4))

const keys = rows.flatMap((row, rowIndex) => {
  let cursor = 0
  return row.flatMap((item) => {
    if ('gap' in item) {
      cursor += item.gap
      return []
    }
    const x = round((cursor + item.width / 2 - columns / 2) * pitch)
    cursor += item.width
    return [
      {
        ...item,
        row: rowIndex,
        x,
        // Toward the back of the board is positive, matching Blender's Y axis.
        y: round((2 - rowIndex) * pitch),
        stabilized: stabilized.has(item.code),
        homing: homing.has(item.code),
      },
    ]
  })
})

const layout = {
  name: 'GMK67',
  pitch,
  columns,
  rows: rows.length,
  knob: { x: round(7.72 * pitch), y: round(2.1 * pitch) },
  indicator: { x: round(4.75 * pitch), y: round(-2 * pitch), width: 0.72, depth: 1.8 },
  // All in centimetres, in the plate's coordinate frame (plate top is z = 0).
  case: {
    width: 32.5,
    depth: 11.65,
    cornerRadius: 0.5,
    topZ: 0.55,
    partingZ: -0.3,
    frontBottomZ: -1.25,
    tiltDegrees: 5.2,
    // Where the lid seam leaves the desk and where it levels out along the side.
    seamStartY: -2,
    seamEndY: 4.4,
  },
  keys,
}

writeFileSync('src/data/layout.gmk67.json', `${JSON.stringify(layout, null, 2)}\n`)
