import { expect, test, type Page } from '@playwright/test'
import {
  canvasImage,
  openConfigurator,
  sameImage,
  trackErrors,
  waitForStillCanvas,
} from './helpers'

const startTest = async (page: Page) => {
  await page.getByRole('button', { name: 'Test' }).click()
  await expect(page.locator('.phrase')).toBeVisible()
}

const phraseText = async (page: Page) =>
  (await page.locator('.phrase').getAttribute('aria-label')) ?? ''

test('runs a full test and shows results', async ({ page }) => {
  const errors = trackErrors(page)
  await openConfigurator(page)
  await startTest(page)
  await page.keyboard.type(await phraseText(page), { delay: 8 })
  await expect(page.getByText('Accuracy')).toBeVisible()
  await expect(page.locator('.result-stats dd').nth(1)).toHaveText('100%')
  expect(errors).toEqual([])
})

test('a finished run shows where you typed on the board', async ({ page }) => {
  await openConfigurator(page)
  await startTest(page)
  await waitForStillCanvas(page)
  const before = await canvasImage(page)
  await page.keyboard.type(await phraseText(page), { delay: 8 })
  await expect(page.getByText('Missed')).toBeVisible()
  await waitForStillCanvas(page)
  expect(sameImage(await canvasImage(page), before)).toBe(false)
})

test('counts mistakes and lets you correct them', async ({ page }) => {
  await openConfigurator(page)
  await startTest(page)
  await page.keyboard.type('#')
  await expect(page.locator('.phrase [data-status="miss"]')).toHaveCount(1)
  await page.keyboard.press('Backspace')
  await expect(page.locator('.phrase [data-status="miss"]')).toHaveCount(0)
  await page.keyboard.type(await phraseText(page), { delay: 8 })
  await expect(page.locator('.result-stats dd').nth(1)).not.toHaveText('100%')
})

test('retry starts a fresh phrase', async ({ page }) => {
  await openConfigurator(page)
  await startTest(page)
  const first = await phraseText(page)
  await page.keyboard.type(first, { delay: 8 })
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(page.locator('.phrase')).toBeVisible()
  expect(await phraseText(page)).not.toBe(first)
})

test('escape returns to the configurator with the build intact', async ({ page }) => {
  await openConfigurator(page, '?case=sky')
  await startTest(page)
  await page.keyboard.press('Escape')
  await expect(page.locator('.phrase')).toHaveCount(0)
  await expect(page.locator('.app')).toHaveAttribute('data-mode', 'configure')
  await expect(page).toHaveURL(/case=sky/)
})

test('back button leaves the results', async ({ page }) => {
  await openConfigurator(page)
  await startTest(page)
  await page.keyboard.type(await phraseText(page), { delay: 8 })
  await page.getByRole('button', { name: 'Back to configurator' }).click()
  await expect(page.locator('.app')).toHaveAttribute('data-mode', 'configure')
})

test('configurator controls are unreachable during a test', async ({ page }) => {
  await openConfigurator(page)
  await startTest(page)
  await expect(page.locator('.panel')).toHaveCSS('pointer-events', 'none')
})
