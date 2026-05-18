/**
 * 시드된 데모 계정 — /login/{role} 화면에 노출.
 * 운영 전환 시 .env 의 NEXT_PUBLIC_SHOW_TEST_ACCOUNTS=0 으로 숨김.
 */

export interface TestAccount {
  phone: string;
  password: string;
  label: string;
  hint?: string;
}

const PW = 'pickup1234!';

export const TEST_ACCOUNTS: Record<'admin' | 'warehouse' | 'store' | 'customer', TestAccount[]> = {
  admin: [
    {
      phone: '01000000000',
      password: PW,
      label: '관리자',
      hint: '전체 운영 + CMS + 정산',
    },
  ],
  warehouse: [
    {
      phone: '01000000001',
      password: PW,
      label: '픽업서비스 업체 직원',
      hint: '주문 처리 + 출고 + 재고 + 입고 스캔',
    },
  ],
  store: [
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
  // 빈 string / undefined → true (개발 + 데모 환경 기본 노출)
  // '0' / 'false' 명시 시에만 숨김
  const v = process.env.NEXT_PUBLIC_SHOW_TEST_ACCOUNTS;
  if (v === '0' || v === 'false') return false;
  return true;
}
