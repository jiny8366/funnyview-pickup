/**
 * 고객 워크플로우 QA (task #28, w1) — 운영(prod) 대상.
 * 가입(API) → 로그인 검증 → 재고 variant 탐색 → 주문생성(API) → 주문조회(UI) 까지.
 * 실행: npx tsx e2e/qa/workflow-customer.ts
 * 결과: qa-out/workflow/ (report.json + 스크린샷). orderId 를 stdout 으로 남김(staff/store 후속용).
 */
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const CUST = process.env.QA_CUST ?? 'https://funnyview-pickup.vercel.app'
const OUT = 'qa-out/workflow'
const steps: { step: string; ok: boolean; detail: string }[] = []
const rec = (step: string, ok: boolean, detail = '') => {
  steps.push({ step, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${step}${detail ? ' — ' + detail : ''}`)
}

;(async () => {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ locale: 'ko-KR', viewport: { width: 1366, height: 900 } })
  const page = await ctx.newPage()
  const req = ctx.request

  const stamp = Date.now()
  const account = {
    email: `qa-w1+${stamp}@example.com`,
    password: 'Qaw1!234',
    passwordConfirm: 'Qaw1!234',
    name: 'QA-w1 테스트',
    phone: '010' + String(stamp).slice(-8),
    memberType: 'online',
  }
  let orderId = ''

  try {
    // [1] 가입 (실제 백엔드)
    const rReg = await req.post(`${CUST}/api/auth/register`, { data: account })
    const regBody = await rReg.text()
    rec('회원가입 POST /api/auth/register', rReg.ok(), `status=${rReg.status()} ${regBody.slice(0, 200)}`)

    // [2] 로그인 상태 검증 (가입이 세션쿠키를 세팅하는지) — UI 진입
    await page.goto(`${CUST}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1000)
    const meOrders = await req.get(`${CUST}/api/orders`)
    rec('가입 후 인증 세션 확인 (GET /api/orders)', meOrders.status() !== 401, `status=${meOrders.status()}`)

    // 세션이 없으면 UI 로그인 시도
    if (meOrders.status() === 401) {
      await page.goto(`${CUST}/login`, { waitUntil: 'domcontentloaded' })
      await page.locator('input[autocomplete="username"], input[type="email"], input[type="text"]').first().fill(account.email)
      await page.locator('input[type="password"]').first().fill(account.password)
      await page.getByRole('button', { name: /로그인/ }).click().catch(() => {})
      await page.waitForTimeout(2000)
      const after = await req.get(`${CUST}/api/orders`)
      rec('UI 로그인 fallback', after.status() !== 401, `status=${after.status()}`)
    }

    // [3] 픽업매장 1곳
    const rStores = await req.get(`${CUST}/api/stores`)
    const stores = (await rStores.json()).stores ?? []
    const storeId = stores[0]?.id
    rec('픽업매장 확보 (/api/stores)', !!storeId, storeId ? `${stores[0].name} ${storeId}` : '매장없음')

    // [4] 재고 있는 variant 탐색 (catalog → product detail 순회)
    const rCat = await req.get(`${CUST}/api/catalog`)
    const lenses = (await rCat.json()).lenses ?? []
    let variantId = ''; let variantInfo = ''
    for (const lens of lenses.slice(0, 50)) {
      const rp = await req.get(`${CUST}/api/products/${encodeURIComponent(lens.productCode)}`)
      if (!rp.ok()) continue
      const p = (await rp.json()).product
      const v = (p?.variants ?? []).find((x: { available: number }) => x.available > 0)
      if (v) { variantId = v.variantId; variantInfo = `${lens.productCode} SPH${v.sphere} 재고${v.available}`; break }
    }
    rec('재고 있는 variant 탐색', !!variantId, variantId ? variantInfo : '첫 50종 중 재고 variant 없음')

    // [5] 주문 생성
    if (storeId && variantId) {
      const rOrder = await req.post(`${CUST}/api/orders`, {
        data: { pickupStoreId: storeId, customerNote: 'QA-w1 자동 점검 주문', lines: [{ variantId, eyeSide: 'right', quantity: 1 }], payOnline: false },
      })
      const ob = await rOrder.json().catch(() => ({}))
      orderId = ob.orderId ?? ''
      rec('주문 생성 POST /api/orders', rOrder.ok() && !!orderId, `status=${rOrder.status()} ${JSON.stringify(ob).slice(0, 200)}`)
    } else {
      rec('주문 생성', false, '선행조건(매장/variant) 미충족으로 건너뜀')
    }

    // [6] 주문 조회 (UI)
    if (orderId) {
      const resp = await page.goto(`${CUST}/customer/orders/${orderId}`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(2000)
      await page.screenshot({ path: `${OUT}/order-detail.png`, fullPage: true }).catch(() => {})
      const body = await page.locator('body').innerText().catch(() => '')
      rec('주문 상세 UI 렌더', (resp?.status() ?? 0) === 200 && body.length > 200, `status=${resp?.status()} bodyLen=${body.length}`)
    }

    // 주문목록 UI 도 스냅샷
    await page.goto(`${CUST}/customer/orders`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${OUT}/orders-list.png`, fullPage: true }).catch(() => {})
  } catch (e) {
    rec('치명적 예외', false, String(e).slice(0, 300))
  }

  writeFileSync(`${OUT}/report.json`, JSON.stringify({ account, orderId, steps }, null, 2))
  await browser.close()
  console.log(`\nORDER_ID=${orderId}`)
  console.log(`ACCOUNT_EMAIL=${account.email}`)
})().catch((e) => { console.error(e); process.exit(1) })
