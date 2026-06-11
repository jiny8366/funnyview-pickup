import { chromium, devices } from '@playwright/test'

;(async () => {
  const b = await chromium.launch()
  const ctx = await b.newContext({ ...devices['iPhone 13'] })
  const p = await ctx.newPage()
  await p.goto('http://localhost:4000/?token=jiny-7a38f3310a56e33ad19c', { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(3500)
  await p.screenshot({ path: 'qa-out/gt-mobile.png', fullPage: true })
  await b.close()
  console.log('shot done')
})().catch((e) => { console.error(e); process.exit(1) })
