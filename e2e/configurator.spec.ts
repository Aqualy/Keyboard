import { expect, test } from '@playwright/test'
import {
  canvasImage,
  choose,
  openConfigurator,
  openFolder,
  sameImage,
  stageBox,
  trackErrors,
  waitForStillCanvas,
} from './helpers'

test('starts as a white GMK67 with a clean URL', async ({ page }) => {
  const errors = trackErrors(page)
  await openConfigurator(page)
  await expect(page.getByRole('heading', { name: 'GMK67' })).toBeVisible()
  await expect(
    page.getByRole('group', { name: 'Colourway' }).getByRole('radio', { name: 'White' }),
  ).toBeChecked()
  expect(new URL(page.url()).search).toBe('')
  expect(errors).toEqual([])
})

test('has no horizontal page overflow', async ({ page }) => {
  await openConfigurator(page)
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBe(0)
})

test('every option group changes the rendered board', async ({ page }) => {
  await openConfigurator(page)
  const changes: [string, string][] = [
    ['Colourway', 'Beet'],
    ['Case colour', 'Sky'],
    ['Profile', 'SA'],
    ['Profile', 'XDA'],
    ['Plate', 'Brass'],
    ['Knob', 'Black'],
  ]
  for (const [group, option] of changes) {
    const before = await canvasImage(page)
    await choose(page, group, option)
    await page.waitForTimeout(900)
    expect(sameImage(await canvasImage(page), before), `${group}: ${option}`).toBe(false)
  }
})

test('keycap colour targets one zone at a time', async ({ page }) => {
  await openConfigurator(page)
  await choose(page, 'Colour', 'Mods')
  await choose(page, 'Mods colour', 'Oak')
  await expect(page.locator('.summary p')).toHaveText('Custom')
  await expect(page).toHaveURL(/mod=oak/)
  await choose(page, 'Colour', 'Legends')
  await choose(page, 'Legend colour', 'Rose')
  await expect(page).toHaveURL(/legend=rose/)
})

test('switch choice updates its specs', async ({ page }) => {
  await openConfigurator(page)
  await choose(page, 'Type', 'Clicky')
  await choose(page, 'Switch', 'MX Blue')
  await expect(page.getByText('Bump + click')).toBeAttached()
  await expect(page).toHaveURL(/switch=mxblue/)
})

test('a shared URL restores the build after reload', async ({ page }) => {
  await openConfigurator(page, '?case=beet&alpha=beet&mod=plum&accent=plum&legend=rose&profile=sa')
  await expect(page.locator('.summary p')).toHaveText('Beet')
  await page.reload()
  await expect(page.locator('.app')).toHaveAttribute('data-ready', 'true')
  await openFolder(page, 'Keycaps')
  await expect(
    page.getByRole('group', { name: 'Profile' }).getByRole('radio', { name: 'SA' }),
  ).toBeChecked()
})

test('a corrupt URL falls back to the default build', async ({ page }) => {
  const errors = trackErrors(page)
  await openConfigurator(page, '?case=%3Cscript%3E&profile=nope&plate=%')
  await expect(page.locator('.summary p')).toHaveText('White')
  expect(errors).toEqual([])
})

test('an open folder lifts its part out of the board, and Case puts it back', async ({ page }) => {
  await openConfigurator(page)
  let previous = await canvasImage(page)
  for (const folder of ['Switches', 'Plate', 'Keycaps', 'Case']) {
    await openFolder(page, folder)
    await waitForStillCanvas(page)
    const next = await canvasImage(page)
    expect(sameImage(next, previous), folder).toBe(false)
    previous = next
  }
})

test('an isolated part survives the exploded view and the typing test', async ({ page }) => {
  const errors = trackErrors(page)
  await openConfigurator(page)
  await openFolder(page, 'Switches')
  await page.getByRole('button', { name: 'Explode keyboard' }).click()
  await waitForStillCanvas(page)
  await page.getByRole('button', { name: 'Assemble keyboard' }).click()
  await waitForStillCanvas(page)
  await page.getByRole('button', { name: 'Test' }).click()
  await page.keyboard.press('Escape')
  await expect(page.locator('.folder-tab', { hasText: 'Switches' })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
  expect(errors).toEqual([])
})

test('the lighting folder darkens the room and lights the board', async ({ page }) => {
  const errors = trackErrors(page)
  await openConfigurator(page)
  await openFolder(page, 'Lighting')
  await expect(page.locator('.app')).toHaveAttribute('data-dark', 'true')
  await waitForStillCanvas(page)
  const unlit = await canvasImage(page)
  await choose(page, 'Effect', 'Static')
  await choose(page, 'Light colour', 'Red')
  await expect(page).toHaveURL(/rgb=static/)
  await expect(page).toHaveURL(/rgbColour=red/)
  await waitForStillCanvas(page)
  expect(sameImage(await canvasImage(page), unlit)).toBe(false)
  await openFolder(page, 'Case')
  await expect(page.locator('.app')).toHaveAttribute('data-dark', 'false')
  expect(errors).toEqual([])
})

test('explodes into labelled layers and reassembles', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'Hover is desktop only')
  await openConfigurator(page)
  const assembled = await canvasImage(page)
  await page.getByRole('button', { name: 'Explode keyboard' }).click()
  await page.waitForTimeout(2200)
  expect(sameImage(await canvasImage(page), assembled)).toBe(false)

  const box = await stageBox(page)
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5)
  await page.mouse.move(box.x + box.width * 0.5 + 3, box.y + box.height * 0.5)
  await expect(page.locator('.part-label')).toBeVisible()

  await page.getByRole('button', { name: 'Assemble keyboard' }).click()
  await page.waitForTimeout(2200)
  await expect(page.getByRole('button', { name: 'Explode keyboard' })).toBeVisible()
})

test('physical keys press the 3D board', async ({ page }) => {
  await openConfigurator(page)
  const before = await canvasImage(page)
  await page.keyboard.down('KeyH')
  await page.waitForTimeout(300)
  expect(sameImage(await canvasImage(page), before)).toBe(false)
  await page.keyboard.up('KeyH')
})

test('clicking a key on the board presses it', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'Covered by the desktop project')
  await openConfigurator(page)
  const box = await stageBox(page)
  const before = await canvasImage(page)
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.42)
  await page.mouse.down()
  await page.waitForTimeout(300)
  expect(sameImage(await canvasImage(page), before)).toBe(false)
  await page.mouse.up()
})

test('dragging orbits the camera and retires the 360 hint', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'Uses a mouse drag')
  await openConfigurator(page)
  await expect(page.locator('.orbit-hint')).toHaveAttribute('data-hidden', 'false')
  const before = await canvasImage(page)
  const box = await stageBox(page)
  await page.mouse.move(box.x + 30, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + 170, box.y + box.height / 2, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(1000)
  expect(sameImage(await canvasImage(page), before)).toBe(false)
  await expect(page.locator('.orbit-hint')).toHaveAttribute('data-hidden', 'true')
})

test('releases every held key when the window loses focus', async ({ page }) => {
  const errors = trackErrors(page)
  await openConfigurator(page)
  const untouched = await canvasImage(page)
  for (const key of ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyJ', 'KeyK', 'KeyL', 'Space']) {
    await page.keyboard.down(key)
  }
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await waitForStillCanvas(page)
  expect(sameImage(await canvasImage(page), untouched)).toBe(true)
  expect(errors).toEqual([])
})
