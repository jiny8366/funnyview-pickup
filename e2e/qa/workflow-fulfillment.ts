/**
 * 주문 이행 워크플로우 QA (task #28, w1) — 운영(prod).
 * staff(픽업서비스): pick → ship(FIFO 차감)  →  store(가맹점): arrive → ready → complete(결제)
 * 각 포털 로그인(마스터 admin) + 주문화면 스크린샷 + 전이 API 호출 + 최종 상태검증.
 * 실행: ORDER_ID=<uuid> npx tsx e2e/qa/workflow-fulfillment.ts
 */
import { chromium, type APIRequestContext } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const CUST = 'https://funnyview-pickup.vercel.app'
const STAFF = 'https://staff-funnyview-pickup.vercel.app'
const STORE = 'https://store-funnyview-pickup.vercel.app'
const OUT = 'qa-out/workflow'
const ORDER = process.env.ORDER_ID ?? ''
const MASTER = { phone: 'jiny8366', password: '2282' }

const steps: { step: string; ok: boolean; detail: string }[] = []
const rec = (step: string, ok: boolean, detail = '') => {
  steps.push({ step, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${step}${detail ? ' — ' + detail : ''}`)
}
const login = async (req: APIRequestContext, base: string) => {
  const r = await req.post(`${base}/api/auth/login`, { data: MASTER })
  return r.ok()
}
const transit = async (req: APIRequestContext, url: string, body: object) => {
  const r = await req.post(url, { data: body })
  const t = await r.text()
  return { ok: r.ok(), status: r.status(), body: t.slice(0, 150) }
}

;(async () => {
  if (!ORDER) { console.error('ORDER_ID 환경변수 필요'); process.exit(2) }
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ locale: 'ko-KR', viewport: { width: 1366, height: 900 } })
  const page = await ctx.newPage()
  const req = ctx.request

  try {
    // ===== STAFF (픽업서비스) =====
    rec('staff 로그인(마스터)', await login(req, STAFF))
    await page.goto(`${STAFF}/warehouse/orders`, { waitUntil: 'domcontentloaded' }).catch(() => {})
    await page.waitForTimeout(2000)
    await page.screenshot({ path: `${OUT}/staff-orders.png`, fullPage: true }).catch(() => {})

    let r = await transit(req, `${STAFF}/api/warehouse/orders/${ORDER}/transition`, { action: 'pick' })
    rec('staff: 패킹시작(pick) pending→picking', r.ok, `${r.status} ${r.body}`)
    r = await transit(req, `${STAFF}/api/warehouse/orders/${ORDER}/transition`, { action: 'ship' })
    rec('staff: 배송(ship) picking→shipped (FIFO 차감)', r.ok, `${r.status} ${r.body}`)

    // ===== STORE (가맹점) =====
    rec('store 로그인(마스터)', await login(req, STORE))
    await page.goto(`${STORE}/store/pickup`, { waitUntil: 'domcontentloaded' }).catch(() => {})
    await page.waitForTimeout(2000)
    await page.screenshot({ path: `${OUT}/store-pickup.png`, fullPage: true }).catch(() => {})

    r = await transit(req, `${STORE}/api/store/orders/${ORDER}/transition`, { action: 'arrive' })
    rec('store: 입고(arrive) shipped→arrived', r.ok, `${r.status} ${r.body}`)
    r = await transit(req, `${STORE}/api/store/orders/${ORDER}/transition`, { action: 'ready' })
    rec('store: 픽업준비(ready) arrived→ready', r.ok, `${r.status} ${r.body}`)
    r = await transit(req, `${STORE}/api/store/orders/${ORDER}/transition`, { action: 'complete', payment: { method: 'card', amount: 15000 } })
    rec('store: 픽업완료+결제(complete) ready→completed', r.ok, `${r.status} ${r.body}`)

    // ===== 최종 검증 (고객 화면) =====
    rec('고객 재로그인', await login(req, CUST))
    const resp = await page.goto(`${CUST}/customer/orders/${ORDER}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    await page.screenshot({ path: `${OUT}/order-final.png`, fullPage: true }).catch(() => {})
    const body = await page.locator('body').innerText().catch(() => '')
    const completed = /완료|픽업완료|결제완료/.test(body)
    rec('최종: 고객 주문상세 = 완료 반영', (resp?.status() ?? 0) === 200 && completed, `status=${resp?.status()} matchedDone=${completed}`)
  } catch (e) {
    rec('치명적 예외', false, String(e).slice(0, 300))
  }

  writeFileSync(`${OUT}/fulfillment-report.json`, JSON.stringify({ order: ORDER, steps }, null, 2))
  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
