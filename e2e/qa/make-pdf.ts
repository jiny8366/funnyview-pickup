import { chromium } from '@playwright/test'
import path from 'node:path'
;(async () => {
  const src = 'file:///' + path.resolve('qa-out/report.html').split(path.sep).join('/')
  const out = path.resolve('qa-out/funnyview-qa-golive-report.pdf')
  const b = await chromium.launch()
  const p = await b.newPage()
  await p.goto(src, { waitUntil: 'networkidle' })
  await p.pdf({ path: out, format: 'A4', printBackground: true,
    margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' } })
  await b.close()
  console.log('PDF:', out)
})().catch((e) => { console.error(e); process.exit(1) })
