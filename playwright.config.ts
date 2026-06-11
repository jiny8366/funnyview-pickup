import { defineConfig, devices } from '@playwright/test'

/**
 * Funnyview Pickup — E2E (고객 플로우 QA 자동화)
 * 담당: w1 (task #28)
 *
 * 실행 전제: 로컬 DB(docker postgres) + `npm run dev`(:3001)가 떠 있어야 함.
 *   docker 복구 전에는 스펙 "작성"만 가능(이 파일·e2e/ 는 DB 불필요 코드작업).
 *   docker 복구 후: `npm run test:e2e` (webServer가 dev 서버를 자동 기동/재사용).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'ko-KR',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  // 로컬 dev 서버 자동 기동(이미 떠 있으면 재사용). DB가 없으면 dev가 못 떠서 여기서 실패함 → docker 복구 후 동작.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
