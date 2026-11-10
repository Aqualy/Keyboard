// Measures a first visit: a fresh browser per run, so no shader or HTTP cache helps.
// Usage: npm run build && npm run preview, then
//   node tools/measure-load.mjs http://127.0.0.1:4173/ [more URLs to compare, run in turn]
// RUNS=6 sets runs per URL, THROTTLE=1 emulates a fast 4G link.
//
// "visible" is when the Loading cover goes; "smooth" is the first frame after which no frame takes
// longer than 100 ms, which includes compiling shaders. Playwright's Chromium can't load the DXC shader
// compiler here, so WebGPU is forced onto FXC, which is slower than real Chrome: read the numbers as
// relative, not absolute.
import { chromium } from '@playwright/test'

const urls = process.argv.slice(2)
if (!urls.length) urls.push('http://127.0.0.1:4173/')
const runs = Number(process.env.RUNS ?? 5)
const args = [
  '--use-angle=d3d11',
  '--enable-unsafe-webgpu',
  '--ignore-gpu-blocklist',
  '--disable-dawn-features=use_dxc',
]

async function once(url) {
  const browser = await chromium.launch({ args })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  if (process.env.THROTTLE) {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 60,
      downloadThroughput: (9 * 1024 * 1024) / 8,
      uploadThroughput: (1.5 * 1024 * 1024) / 8,
    })
  }
  await page.addInitScript(() => {
    const frames = (window.__frames = [])
    const tick = (time) => {
      frames.push(time)
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    new MutationObserver(() => {
      if (document.querySelector('.app')?.getAttribute('data-ready') === 'true') {
        window.__ready ??= performance.now()
      }
    }).observe(document, { subtree: true, attributes: true, childList: true })
  })
  await page.goto(url)
  await page.locator('.app[data-ready="true"]').waitFor({ timeout: 60_000 })
  await page.waitForTimeout(9000)
  const result = await page.evaluate(() => {
    const { __frames: frames, __ready: ready } = window
    let smooth = ready
    for (let i = 1; i < frames.length; i++) {
      if (frames[i] > ready && frames[i] - frames[i - 1] > 100) smooth = frames[i]
    }
    return { visible: Math.round(ready), smooth: Math.round(smooth) }
  })
  await browser.close()
  return result
}

const results = Object.fromEntries(urls.map((url) => [url, []]))
for (let run = 0; run < runs; run++) {
  for (const url of urls) results[url].push(await once(url))
}
const median = (values) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]
for (const [url, list] of Object.entries(results)) {
  console.log(
    `${url}${process.env.THROTTLE ? ' (fast 4G)' : ''}: visible ${median(list.map((r) => r.visible))} ms,`,
    `smooth ${median(list.map((r) => r.smooth))} ms (median of ${list.length})`,
  )
}
