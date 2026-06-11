/**
 * 시드된 데모 계정 — /login/{role} 화면에 노출.
 * 운영 전환 시 .env 의 NEXT_PUBLIC_SHOW_TEST_ACCOUNTS=0 으로 숨김.
 */

export interface TestAccount {
  phone: string;
  password: string;
  label: string;
  hint?: string;
  primary?: boolean; // 통합 계정 강조 표시
}

const PW = 'pickup1234!';

/**
 * 모든 portal 에서 동작하는 통합 테스트 계정.
 * admin role 이라 expectedRole 검사를 통과 (login API 의 정책).
 */
export const UNIFIED_TEST_ACCOUNT: TestAccount = {
  phone: 'jiny8366',
  password: '2282',
  label: '통합 테스트 계정',
  hint: '모든 portal (퍼니뷰 관리자/픽업관리/픽업가맹점/고객) 진입 가능',
  primary: true,
};

export const TEST_ACCOUNTS: Record<'admin' | 'warehouse' | 'store' | 'customer', TestAccount[]> = {
  admin: [
    UNIFIED_TEST_ACCOUNT,
    {
      phone: '01000000000',
      password: PW,
      label: '퍼니뷰 관리자 (역할별 계정)',
      hint: '전체 운영 + CMS + 정산',
    },
  ],
  warehouse: [
    UNIFIED_TEST_ACCOUNT,
    {
      phone: '01000000001',
      password: PW,
      label: '픽업관리 직원',
      hint: '주문 처리 + 출고 + 재고 + 입고 스캔',
    },
  ],
  store: [
    UNIFIED_TEST_ACCOUNT,
    {
      phone: '01000000002',
      password: PW,
      label: '강남 본점 직원',
      hint: '본점 픽업 처리',
    },
    {
      phone: '01000000003',
      password: PW,
      label: '홍대 지점 직원',
      hint: '홍대 지점 픽업 처리',
    },
    {
      phone: '01000000004',
      password: PW,
      label: '판교 지점 직원',
      hint: '판교 지점 픽업 처리',
    },
  ],
  customer: [
    UNIFIED_TEST_ACCOUNT,
    {
      phone: '01099990001',
      password: PW,
      label: '데모 고객 (성인)',
      hint: '주문 → 픽업 흐름 테스트',
    },
    {
      phone: '01099990002',
      password: PW,
      label: '데모 고객 (시니어)',
      hint: '다초점/가입도 주문 테스트',
    },
  ],
};

export function showTestAccounts(): boolean {
  const v = process.env.NEXT_PUBLIC_SHOW_TEST_ACCOUNTS;
  // 운영 default 는 숨김. dev/preview 에서 보고 싶으면 명시적으로 '1' 설정.
  return v === '1' || v === 'true';
}
