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

/** Picks a radio by name inside one option group. */
export async function choose(page: Page, group: string, option: string) {
  const fieldset = page.getByRole('group', { name: group, exact: true })
  await fieldset.getByRole('radio', { name: option, exact: true }).check({ force: true })
}

export async function stageBox(page: Page) {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('Canvas is not visible')
  return box
}
