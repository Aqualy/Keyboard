import { expect, test, type Page } from '@playwright/test'
import { openConfigurator } from './helpers'

/** Pretends to be a person's browser on a Belgian AZERTY keyboard. */
async function belgianKeyboard(page: Page) {
  await page.addInitScript(() => {
    const keys = { KeyQ: 'a', KeyY: 'y', Digit6: '§', Equal: '-', Backslash: 'µ' }
    Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false })
    Object.defineProperty(Navigator.prototype, 'keyboard', {
      get: () => ({ getLayoutMap: async () => new Map(Object.entries(keys)) }),
    })
  })
}

/** The build in the address bar when the app first appears, before anything can swap it. */
async function recordFirstBuild(page: Page) {
  await page.addInitScript(() => {
    const observer = new MutationObserver(() => {
      if (!document.querySelector('.app')) return
      ;(window as unknown as { firstBuild: string }).firstBuild = location.search
      observer.disconnect()
    })
    observer.observe(document, { childList: true, subtree: true })
  })
  return () => page.evaluate(() => (window as unknown as { firstBuild: string }).firstBuild)
}

test("starts on the visitor's own keyboard layout", async ({ page }) => {
  await belgianKeyboard(page)
  const firstBuild = await recordFirstBuild(page)
  await openConfigurator(page)
  await expect(page.getByText('65% BE')).toBeAttached()
  // Settled before the app first appeared, so nobody sees the US board swapped out.
  expect(await firstBuild()).toBe('?standard=iso&region=be')
})

test('keeps the layout a link asks for', async ({ page }) => {
  await belgianKeyboard(page)
  await openConfigurator(page, '?region=us')
  await expect(page.getByText('65% US')).toBeAttached()
})
