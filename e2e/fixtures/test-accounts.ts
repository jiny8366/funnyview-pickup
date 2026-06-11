/**
 * 시드(scripts/seed.ts) 기준 테스트 계정. CLAUDE.md "통합 테스트 계정" + seed 출력 근거.
 * ※ docker 복구 후 `npm run db:seed` 로 생성되는 계정들. 비밀번호/식별자가 시드와 바뀌면 여기만 갱신.
 */
export const ACCOUNTS = {
  /** admin role — customer/admin/staff/store 4 portal 모두 로그인 가능 */
  master: { id: 'jiny8366', password: '2282' },

  /** 데모 고객 (고객 포털 로그인은 휴대전화 기준) — seed 비밀번호 pickup1234! */
  demoCustomerAdult: { phone: '01099990001', password: 'pickup1234!' },
  demoCustomerSenior: { phone: '01099990002', password: 'pickup1234!' },

  /** 역할별 시드 계정 (참고) */
  admin: { phone: '01000000000', password: 'pickup1234!' },
  warehouse: { phone: '01000000001', password: 'pickup1234!' },
  store: { phone: '01000000002', password: 'pickup1234!' },
} as const

/** 신규 가입 테스트용 유니크 휴대전화 생성 (재실행 충돌 방지). worker index 로 분산. */
export function uniquePhone(seed = 0): string {
  const base = 1070000000 + (seed % 9_000_000)
  return '0' + String(base)
}
