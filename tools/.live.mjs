import { chromium } from '@playwright/test'
const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--disable-dawn-features=use_dxc'] })
const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
p.on('pageerror', (e) => console.log('pageerror', e.message)); p.on('console', (m) => ['error','warning'].includes(m.type()) && console.log(m.type(), m.text().slice(0, 300)))
p.on('response', (r) => r.url().includes('models') && console.log(r.status(), r.url().split('/').pop(), r.headers()['content-encoding'] ?? '', r.headers()['content-type']))
await p.goto(process.argv[2]); await p.waitForTimeout(12000)
console.log('ready attr', await p.locator('.app').getAttribute('data-ready'), '| text:', (await p.locator('.stage').innerText()).slice(0, 200))
await b.close()
