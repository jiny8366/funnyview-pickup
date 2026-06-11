/**
 * 관리자 포털 QA 순회 (task #28, w1) — 운영 사이트 읽기 전용 워크스루.
 * 로그인 후 각 admin 라우트를 방문하며 콘솔에러·실패요청(4xx/5xx)·500화면·스크린샷 수집.
 * 실행: npx tsx e2e/qa/explore-admin.ts
 */
import { chromium, type ConsoleMessage, type Response } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = process.env.QA_BASE ?? 'https://admin-funnyview-pickup.vercel.app'
const OUT = 'qa-out/admin'
const ROUTES = [
  '/admin/home', '/admin/dashboard', '/admin/orders', '/admin/products',
  '/admin/products/new', '/admin/categories', '/admin/customers',
  '/admin/home/analytics', '/admin/price-history', '/admin/settings',
  '/admin/settlement', '/admin/staff', '/admin/staff/new',
  '/admin/stores', '/admin/stores/new',
]

type Row = {
  route: string; status: number; errors: string[]; failed: string[]
  serverErrorScreen: boolean; bodyLen: number; screenshot: string
}

;(async () => {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ locale: 'ko-KR', viewport: { width: 1366, height: 900 } })
  const page = await ctx.newPage()

  // --- 로그인 (아이디=jiny8366 / 비밀번호=2282, master admin) ---
  await page.goto(`${BASE}/login/admin`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[autocomplete="username"]').fill('jiny8366')
  await page.locator('input[type="password"]').fill('2282')
  await page.getByRole('button', { name: '로그인' }).click()
  await page.waitForURL(/\/admin\//, { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1500)
  const afterLogin = page.url()
  console.log(`[login] → ${afterLogin}`)
  if (/\/login\//.test(afterLogin)) {
    console.log('❌ 로그인 실패로 보임 — admin 페이지 진입 못함. 중단.')
    await browser.close(); process.exit(2)
  }

  const report: Row[] = []
  for (const route of ROUTES) {
    const errors: string[] = []
    const failed: string[] = []
    const onConsole = (m: ConsoleMessage) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)) }
    const onPageErr = (e: Error) => errors.push('PAGEERROR: ' + e.message.slice(0, 300))
    const onResp = (r: Response) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`) }
    page.on('console', onConsole); page.on('pageerror', onPageErr); page.on('response', onResp)

    let status = 0
    try {
      const resp = await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 30000 })
      status = resp?.status() ?? 0
    } catch (e) { errors.push('NAV: ' + String(e).slice(0, 200)) }
    await page.waitForTimeout(2000)

    const body = await page.locator('body').innerText().catch(() => '')
    const serverErrorScreen = /Application error|something went wrong|Internal Server Error|이 페이지에서 문제가 발생|500/i.test(body)
    const file = `${OUT}${route.replace(/\//g, '_')}.png`
    await page.screenshot({ path: file, fullPage: true }).catch(() => {})

    report.push({ route, status, errors, failed, serverErrorScreen, bodyLen: body.length, screenshot: file })
    page.off('console', onConsole); page.off('pageerror', onPageErr); page.off('response', onResp)
    console.log(`${status} ${route}  err:${errors.length} failedReq:${failed.length}${serverErrorScreen ? ' ⚠SERVER-ERR' : ''}${body.length < 200 ? ' ⚠EMPTY' : ''}`)
  }

  writeFileSync(`${OUT}/report.json`, JSON.stringify({ base: BASE, ranAt: afterLogin, report }, null, 2))
  await browser.close()
  console.log(`\n✅ done → ${OUT}/report.json`)
})().catch((e) => { console.error(e); process.exit(1) })
