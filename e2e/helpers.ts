import { expect, type Page } from '@playwright/test'

/** Fails a test on page errors. Library deprecation warnings are not errors. */
export function trackErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  return errors
}

export async function openConfigurator(page: Page, query = '') {
  await page.goto(`./${query}`)
  await expect(page.locator('.app')).toHaveAttribute('data-ready', 'true')
  await waitForStillCanvas(page)
}

export const canvasImage = (page: Page) => page.locator('canvas').screenshot()

/** Compares as a boolean, since diffing two image buffers in an assertion hangs the runner. */
export const sameImage = (a: Buffer, b: Buffer) => a.equals(b)

/** Waits out the intro and any animation, so screenshots only differ by what a test did. */
export async function waitForStillCanvas(page: Page) {
  const deadline = Date.now() + 20_000
  let previous = await canvasImage(page)
  while (Date.now() < deadline) {
    await page.waitForTimeout(500)
    const next = await canvasImage(page)
    if (sameImage(next, previous)) return
    previous = next
  }
  throw new Error('The canvas never stopped changing')
}

/** The folder each option group lives in. */
const FOLDER_OF: Record<string, string> = {
  Colourway: 'Case',
  'Case colour': 'Case',
  Knob: 'Case',
  Profile: 'Keycaps',
  Material: 'Keycaps',
  Colour: 'Keycaps',
  'Alphas colour': 'Keycaps',
  'Mods colour': 'Keycaps',
  'Accents colour': 'Keycaps',
  'Legend colour': 'Keycaps',
  Type: 'Switches',
  Switch: 'Switches',
  Plate: 'Plate',
  Size: 'Layout',
  Standard: 'Layout',
  Legends: 'Layout',
  Effect: 'Lighting',
  'Light colour': 'Lighting',
  Brightness: 'Lighting',
  'Coiled cable': 'Desk',
  'Desk mat': 'Desk',
}

/** Opens a configurator folder by its tab. */
export async function openFolder(page: Page, folder: string) {
  const tab = page.locator('.folder-tab', { has: page.getByText(folder, { exact: true }) })
  await tab.click()
  await expect(tab).toHaveAttribute('aria-expanded', 'true')
  // On wide screens the open folder widens over a short transition. Wait for it, as a person
  // would. Narrow screens have no transition, and the folder there has no box of its own.
  const panel = page.locator('.folder', { has: tab })
  let previous = await panel.boundingBox()
  if (!previous) return
  for (let tries = 0; tries < 25; tries += 1) {
    await page.waitForTimeout(80)
    const next = await panel.boundingBox()
    if (!next || (next.x === previous.x && next.width === previous.width)) return
    previous = next
  }
}

/** Picks a radio by name inside one option group, opening its folder first. */
export async function choose(page: Page, group: string, option: string) {
  const folder = FOLDER_OF[group]
  if (!folder) throw new Error(`No folder known for group: ${group}`)
  await openFolder(page, folder)
  const fieldset = page.getByRole('group', { name: group, exact: true })
  await fieldset.getByRole('radio', { name: option, exact: true }).check({ force: true })
}

/** The part of the stage a visitor can see: the canvas above the controls floating over it. */
export async function stageBox(page: Page) {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('Canvas is not visible')
  const inset = await page.evaluate(
    () =>
      parseFloat(
        getComputedStyle(document.querySelector('.app')!).getPropertyValue('--stage-inset'),
      ) || 0,
  )
  return { ...box, height: box.height - inset }
}
