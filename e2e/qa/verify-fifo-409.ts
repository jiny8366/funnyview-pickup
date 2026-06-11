/**
 * A패치 검증 (보드 #2) — ship FIFO 예외가 500→409+메시지 로 바뀌었는지 prod 실측.
 * master 로 주문생성→pick→ship 폴링(배포 반영 대기)→정리(cancel).
 * 실행: npx tsx e2e/qa/verify-fifo-409.ts
 */
import { chromium } from '@playwright/test'

const CUST = 'https://funnyview-pickup.vercel.app'
const STAFF = 'https://staff-funnyview-pickup.vercel.app'
const MASTER = { phone: 'jiny8366', password: '2282' }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext()
  const req = ctx.request
  let orderId = ''
  try {
    await req.post(`${CUST}/api/auth/login`, { data: MASTER })
    const storeId = (await (await req.get(`${CUST}/api/stores`)).json()).stores?.[0]?.id
    // 재고 있는 variant 탐색
    const lenses = (await (await req.get(`${CUST}/api/catalog`)).json()).lenses ?? []
    let variantId = ''
    for (const l of lenses.slice(0, 50)) {
      const p = (await (await req.get(`${CUST}/api/products/${encodeURIComponent(l.productCode)}`)).json()).product
      const v = (p?.variants ?? []).find((x: { available: number }) => x.available > 0)
      if (v) { variantId = v.variantId; break }
    }
    console.log(`store=${storeId} variant=${variantId}`)
    const ord = await (await req.post(`${CUST}/api/orders`, {
      data: { pickupStoreId: storeId, customerNote: 'QA-w1 A패치 검증', lines: [{ variantId, eyeSide: 'right', quantity: 1 }] },
    })).json()
    orderId = ord.orderId
    console.log(`주문생성 ${orderId} (${ord.orderNumber})`)

    await req.post(`${STAFF}/api/auth/login`, { data: MASTER })
    const pick = await req.post(`${STAFF}/api/warehouse/orders/${orderId}/transition`, { data: { action: 'pick' } })
    console.log(`pick ${pick.status()}`)

    // ship 폴링 — 배포 전 500, 후 409 기대
    for (let i = 1; i <= 15; i++) {
      const r = await req.post(`${STAFF}/api/warehouse/orders/${orderId}/transition`, { data: { action: 'ship' } })
      const body = await r.text()
      console.log(`[${i}] ship ${r.status()} ${body.slice(0, 160)}`)
      if (r.status() === 409) { console.log('✅ A패치 반영 — 409 + 메시지 확인'); break }
      if (r.status() === 200) { console.log('⚠ ship 200 (로트가 생겼다는 뜻 — B1 적용됐거나 재고변화)'); break }
      await sleep(20_000)
    }
  } catch (e) {
    console.error('예외', String(e).slice(0, 200))
  } finally {
    if (orderId) {
      const c = await req.post(`${STAFF}/api/warehouse/orders/${orderId}/transition`, { data: { action: 'cancel', reason: 'QA-w1 A패치 검증 정리' } })
      console.log(`정리 cancel ${c.status()}`)
    }
    await browser.close()
  }
})().catch((e) => { console.error(e); process.exit(1) })
