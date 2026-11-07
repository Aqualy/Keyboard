/**
 * Printed legends per region. A layout file carries the US (ANSI) or UK (ISO) set, and each
 * region lists only the keys it prints differently, as [shifted, unshifted] like the layouts.
 * AltGr symbols are left off, as on most printed keycap sets.
 */
export type Standard = 'ansi' | 'iso'

const AZERTY_LETTERS: Record<string, string[]> = {
  KeyQ: ['A'],
  KeyW: ['Z'],
  KeyA: ['Q'],
  KeyZ: ['W'],
  Semicolon: ['M'],
}

export const REGIONS = [
  { id: 'us', name: 'US', standard: 'ansi', legends: {} },
  {
    id: 'uk',
    name: 'UK',
    standard: 'iso',
    legends: {
      Digit2: ['"', '2'],
      Digit3: ['£', '3'],
      Quote: ['@', "'"],
      Backquote: ['¬', '`'],
    },
  },
  {
    id: 'de',
    name: 'DE',
    standard: 'iso',
    legends: {
      Backquote: ['°', '^'],
      Digit2: ['"', '2'],
      Digit3: ['§', '3'],
      Digit6: ['&', '6'],
      Digit7: ['/', '7'],
      Digit8: ['(', '8'],
      Digit9: [')', '9'],
      Digit0: ['=', '0'],
      Minus: ['?', 'ß'],
      Equal: ['`', '´'],
      KeyY: ['Z'],
      KeyZ: ['Y'],
      BracketLeft: ['Ü'],
      BracketRight: ['*', '+'],
      Semicolon: ['Ö'],
      Quote: ['Ä'],
      Backslash: ["'", '#'],
      IntlBackslash: ['>', '<'],
      Comma: [';', ','],
      Period: [':', '.'],
      Slash: ['_', '-'],
    },
  },
  {
    id: 'fr',
    name: 'FR',
    standard: 'iso',
    legends: {
      ...AZERTY_LETTERS,
      Backquote: ['', '²'],
      Digit1: ['1', '&'],
      Digit2: ['2', 'é'],
      Digit3: ['3', '"'],
      Digit4: ['4', "'"],
      Digit5: ['5', '('],
      Digit6: ['6', '-'],
      Digit7: ['7', 'è'],
      Digit8: ['8', '_'],
      Digit9: ['9', 'ç'],
      Digit0: ['0', 'à'],
      Minus: ['°', ')'],
      Equal: ['+', '='],
      BracketLeft: ['¨', '^'],
      BracketRight: ['£', '$'],
      Quote: ['%', 'ù'],
      Backslash: ['µ', '*'],
      IntlBackslash: ['>', '<'],
      KeyM: ['?', ','],
      Comma: ['.', ';'],
      Period: ['/', ':'],
      Slash: ['§', '!'],
    },
  },
  {
    id: 'be',
    name: 'BE',
    standard: 'iso',
    legends: {
      ...AZERTY_LETTERS,
      Backquote: ['³', '²'],
      Digit1: ['1', '&'],
      Digit2: ['2', 'é'],
      Digit3: ['3', '"'],
      Digit4: ['4', "'"],
      Digit5: ['5', '('],
      Digit6: ['6', '§'],
      Digit7: ['7', 'è'],
      Digit8: ['8', '!'],
      Digit9: ['9', 'ç'],
      Digit0: ['0', 'à'],
      Minus: ['°', ')'],
      Equal: ['_', '-'],
      BracketLeft: ['¨', '^'],
      BracketRight: ['*', '$'],
      Quote: ['%', 'ù'],
      Backslash: ['£', 'µ'],
      IntlBackslash: ['>', '<'],
      KeyM: ['?', ','],
      Comma: ['.', ';'],
      Period: ['/', ':'],
      Slash: ['+', '='],
    },
  },
] as const satisfies readonly {
  id: string
  name: string
  standard: Standard
  legends: Record<string, readonly string[]>
}[]

export type RegionId = (typeof REGIONS)[number]['id']

/** The legend a key prints in a region, falling back to the layout's own set. */
export function legendFor(region: RegionId, code: string, fallback: readonly string[]) {
  const legends: Record<string, readonly string[]> = REGIONS.find((r) => r.id === region)!.legends
  return legends[code] ?? fallback
}

/** The first region of a standard, used when the standard changes. */
export const defaultRegion = (standard: Standard): RegionId =>
  REGIONS.find((region) => region.standard === standard)!.id
