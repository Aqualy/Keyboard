/**
 * Guesses the visitor's keyboard region, so the board first appears with the legends they type on.
 * The keyboard's own layout map is the best source, but only Chromium browsers expose it. Elsewhere
 * the browser's languages are the hint.
 */
import type { RegionId } from './regions'

/** What a key types without Shift, by physical key code, as `navigator.keyboard` reports it. */
export type LayoutMap = Pick<Map<string, string>, 'get'>

/** Reads the region from what a few telling keys type, or undefined if the map is empty. */
export function regionFromLayoutMap(map: LayoutMap): RegionId | undefined {
  const char = (code: string) => map.get(code)?.toLowerCase()
  // Some systems hand back an empty map; the languages are a better guess than US then.
  if (!char('KeyQ')) return undefined
  if (char('KeyQ') === 'a') {
    // Both are AZERTY. Belgian prints § on 6 and - on the key left of Backspace, French - on 6.
    return char('Digit6') === '§' || char('Equal') === '-' ? 'be' : 'fr'
  }
  if (char('KeyY') === 'z') return 'de'
  // UK puts # where US has a backslash, beside Enter.
  if (char('Backslash') === '#') return 'uk'
  return 'us'
}

/** Reads the region from the browser's preferred languages, or undefined if none gives a hint. */
export function regionFromLanguages(languages: readonly string[]): RegionId | undefined {
  for (const tag of languages) {
    const [language, country] = tag.toLowerCase().split('-')
    // Belgium types on its own AZERTY in French, Dutch and German alike.
    if (country === 'be') return 'be'
    if (language === 'de') return 'de'
    // Canadian and Swiss French type on other layouts, so only plain or France French counts.
    if (language === 'fr' && (!country || country === 'fr')) return 'fr'
    if (language === 'en' && (country === 'gb' || country === 'ie')) return 'uk'
    if (language === 'en') return 'us'
  }
  return undefined
}

interface KeyboardApi {
  getLayoutMap?: () => Promise<LayoutMap>
}

/** How long to wait for the layout map before falling back, so a slow browser never holds up the board. */
const LAYOUT_MAP_TIMEOUT = 300

async function readLayoutMap(keyboard: KeyboardApi | undefined): Promise<LayoutMap | undefined> {
  if (!keyboard?.getLayoutMap) return undefined
  const timeout = new Promise<undefined>((resolve) => setTimeout(resolve, LAYOUT_MAP_TIMEOUT))
  // It rejects in some embedded frames; the languages still work there.
  return Promise.race([keyboard.getLayoutMap().catch(() => undefined), timeout])
}

/** The visitor's region, or undefined when nothing hints at one. */
export async function detectRegion(nav: Navigator = navigator): Promise<RegionId | undefined> {
  // Automated browsers keep the plain US board, so tests don't depend on the machine they run on.
  if (nav.webdriver) return undefined
  const map = await readLayoutMap((nav as Navigator & { keyboard?: KeyboardApi }).keyboard)
  return (map && regionFromLayoutMap(map)) ?? regionFromLanguages(nav.languages ?? [nav.language])
}
