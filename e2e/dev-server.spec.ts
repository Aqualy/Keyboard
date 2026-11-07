import { expect, test } from '@playwright/test'
import { canvasImage, openConfigurator, sameImage, stageBox, trackErrors } from './helpers'

test('loads under the dev server, with React running setup twice', async ({ page }) => {
  const errors = trackErrors(page)
  await openConfigurator(page)
  await expect(page.getByText('could not load')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('can still orbit, press keys and explode', async ({ page }) => {
  await openConfigurator(page)

  const start = await canvasImage(page)
  await page.keyboard.down('KeyH')
  await page.waitForTimeout(300)
  expect(sameImage(await canvasImage(page), start)).toBe(false)
  await page.keyboard.up('KeyH')

  const box = await stageBox(page)
  await page.mouse.move(box.x + 30, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + 170, box.y + box.height / 2, { steps: 8 })
  await page.mouse.up()
  await expect(page.locator('.orbit-hint')).toHaveAttribute('data-hidden', 'true')

  await page.getByRole('button', { name: 'Explode keyboard' }).click()
  await expect(page.getByRole('button', { name: 'Assemble keyboard' })).toBeVisible()
})
