import { expect, test } from '@playwright/test'
import { choose, openConfigurator, trackErrors } from './helpers'

test('plays the selected switch, and stays quiet when muted', async ({ page }) => {
  const errors = trackErrors(page)
  const requested: string[] = []
  page.on('response', (response) => {
    if (response.url().includes('/sounds/')) requested.push(response.url())
  })

  await openConfigurator(page)
  expect(requested).toEqual([])

  await page.getByRole('button', { name: 'Mute sound' }).click()
  await page.keyboard.press('KeyA')
  await page.waitForTimeout(300)
  expect(requested).toEqual([])

  await page.getByRole('button', { name: 'Turn sound on' }).click()
  await page.keyboard.press('KeyA')
  await expect.poll(() => requested.some((url) => url.includes('/sounds/linear/'))).toBe(true)

  await choose(page, 'Switch', 'Clicky')
  await expect.poll(() => requested.some((url) => url.includes('/sounds/clicky/'))).toBe(true)
  expect(errors).toEqual([])
})

test('keeps typing working when sounds fail to load', async ({ page }) => {
  await page.route('**/sounds/**', (route) => route.abort())
  await openConfigurator(page)
  await page.keyboard.press('KeyA')
  await page.getByRole('button', { name: 'Test' }).click()
  await page.keyboard.type('a')
  await expect(page.locator('.phrase')).toBeVisible()
})
