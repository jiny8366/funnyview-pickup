import { test, expect } from '@playwright/test'
import { ACCOUNTS, uniquePhone } from './fixtures/test-accounts'

/**
 * 고객 핵심 구매 플로우 E2E (task #28)
 *   탐색 → 상세 → (가입/로그인) → 장바구니 → 픽업예약(주문) → 주문확인
 *
 * 상태: SKELETON. role/label 기반 resilient 셀렉터로 작성하되, 실제 DOM 라벨은
 *       앱이 떠야(=docker/DB) 확정 가능 → `[TODO:selector]` 표시 지점은 첫 실행 때 검증/교정.
 *       docker 복구 전엔 이 파일은 "작성"까지만 (DB불필요 코드작업).
 */

test.describe('고객 구매 플로우', () => {
  test('비로그인 상품 탐색 → 상세 진입', async ({ page }) => {
    await page.goto('/products')
    await expect(page).toHaveURL(/\/products/)
    // [TODO:selector] 상품 카드 컨테이너 라벨 확정 — 우선 링크/이미지 존재로 판정
    const firstProduct = page.locator('a[href*="/products/"]').first()
    await expect(firstProduct).toBeVisible()
    await firstProduct.click()
    await expect(page).toHaveURL(/\/products\/.+/)
  })

  test('신규 회원가입', async ({ page }, testInfo) => {
    await page.goto('/register')
    const phone = uniquePhone(testInfo.workerIndex + 1)
    // [TODO:selector] register 폼 필드 라벨 확정(이메일/비밀번호/비밀번호확인/이름/휴대전화)
    await page.getByLabel(/이름/).fill('E2E 테스트')
    await page.getByLabel(/휴대전화|전화/).fill(phone)
    await page.getByLabel(/^비밀번호$|비밀번호$/).first().fill('Pickup1234!')
    await page.getByLabel(/비밀번호.?확인/).fill('Pickup1234!')
    await page.getByRole('button', { name: /가입|회원가입|완료/ }).click()
    // [TODO:assert] 가입 성공 후 리다이렉트/토스트 확정
    await expect(page).not.toHaveURL(/\/register$/)
  })

  test('데모 고객 로그인', async ({ page }) => {
    await page.goto('/login')
    const { phone, password } = ACCOUNTS.demoCustomerAdult
    // [TODO:selector] 고객 로그인 식별자 = 휴대전화 추정. seed 계정 확정 시 교정.
    await page.getByLabel(/휴대전화|전화|아이디/).fill(phone)
    await page.getByLabel(/비밀번호/).fill(password)
    await page.getByRole('button', { name: /로그인/ }).click()
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('로그인 → 장바구니 담기 → 픽업예약(주문)', async ({ page }) => {
    // 선행: 로그인
    await page.goto('/login')
    await page.getByLabel(/휴대전화|전화|아이디/).fill(ACCOUNTS.demoCustomerAdult.phone)
    await page.getByLabel(/비밀번호/).fill(ACCOUNTS.demoCustomerAdult.password)
    await page.getByRole('button', { name: /로그인/ }).click()
    await expect(page).not.toHaveURL(/\/login/)

    // 상품 상세 → 장바구니
    await page.goto('/products')
    await page.locator('a[href*="/products/"]').first().click()
    await page.getByRole('button', { name: /장바구니|담기/ }).click()

    // 장바구니 확인
    await page.goto('/cart')
    // [TODO:assert] 담긴 항목 1개 이상 표시 확인
    await expect(page.getByText(/장바구니|주문|픽업/).first()).toBeVisible()

    // 픽업예약(주문 생성)
    await page.getByRole('button', { name: /주문|픽업예약|결제|예약/ }).first().click()
    // [TODO:assert] 주문 완료 → /customer/orders 또는 완료 화면
    await expect(page).toHaveURL(/\/customer\/order/)
  })
})
