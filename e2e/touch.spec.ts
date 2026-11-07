import { expect, test } from '@playwright/test'
import { canvasImage, openConfigurator, sameImage, stageBox, waitForStillCanvas } from './helpers'

test.beforeEach(({ hasTouch }) => {
  test.skip(!hasTouch, 'Touch devices only')
})

const stagePoint = async (page: Parameters<typeof stageBox>[0], x: number, y: number) => {
  const box = await stageBox(page)
  return { x: box.x + box.width * x, y: box.y + box.height * y }
}

test('tapping the board does not leave a key stuck down', async ({ page }) => {
  await openConfigurator(page)
  const untouched = await canvasImage(page)
  const { x, y } = await stagePoint(page, 0.5, 0.45)
  await page.touchscreen.tap(x, y)
  await waitForStillCanvas(page)
  expect(sameImage(await canvasImage(page), untouched)).toBe(true)
})

test('tapping a part in the exploded view names it', async ({ page }) => {
  await openConfigurator(page)
  await page.getByRole('button', { name: 'Explode keyboard' }).click()
  await waitForStillCanvas(page)
  const { x, y } = await stagePoint(page, 0.5, 0.5)
  await page.touchscreen.tap(x, y)
  await expect(page.locator('.part-label')).toBeVisible()
})

test('folders open with a tap', async ({ page }) => {
  await openConfigurator(page)
  await page.locator('.folder-tab', { hasText: 'Plate' }).tap()
  await page
    .getByRole('group', { name: 'Plate' })
    .getByRole('radio', { name: 'Brass' })
    .tap({ force: true })
  await expect(page).toHaveURL(/plate=brass/)
})
