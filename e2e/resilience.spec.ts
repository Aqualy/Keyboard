import { expect, test } from '@playwright/test'
import { canvasImage, sameImage, openConfigurator } from './helpers'

test('explains itself when 3D graphics are unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    delete (Navigator.prototype as unknown as { gpu?: unknown }).gpu
    HTMLCanvasElement.prototype.getContext = () => null
  })
  await page.goto('./')
  await expect(page.getByText('needs 3D graphics')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'GMK67' })).toBeVisible()
})

test('shows an error when the model fails to load', async ({ page }) => {
  await page.route('**/models/65-ansi.glb', (route) => route.abort())
  await page.goto('./')
  await expect(page.getByText('could not load')).toBeVisible()
})

test('falls back to WebGL2 without WebGPU', async ({ page }) => {
  await page.addInitScript(() => {
    delete (Navigator.prototype as unknown as { gpu?: unknown }).gpu
  })
  await openConfigurator(page)
  const before = await canvasImage(page)
  await page.keyboard.down('KeyG')
  await page.waitForTimeout(300)
  expect(sameImage(await canvasImage(page), before)).toBe(false)
})

test('respects reduced motion', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce', baseURL })
  const page = await context.newPage()
  await openConfigurator(page)
  await page.getByRole('button', { name: 'Explode keyboard' }).click()
  await page.waitForTimeout(400)
  const first = await canvasImage(page)
  await page.waitForTimeout(500)
  expect(sameImage(await canvasImage(page), first)).toBe(true)
  await context.close()
})

test('keyboard users can reach and operate the controls', async ({ page }) => {
  await openConfigurator(page)
  await page.getByRole('group', { name: 'Colourway' }).getByRole('radio', { name: 'White' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.summary p')).toHaveText('Black')
})
