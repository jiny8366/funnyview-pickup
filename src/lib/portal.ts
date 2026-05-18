/**
 * 역할별 접근 도메인 분리 — Portal 모델.
 *
 * 4개 portal:
 *  - customer: 고객 메인 (소셜 로그인, 주문, 마이페이지)
 *  - admin:    관리자 콘솔 (운영자)
 *  - staff:    픽업서비스 업체 (warehouse 역할)
 *  - store:    픽업가맹점 직원
 *
 * Hostname prefix 로 판별:
 *  - admin-…  → admin
 *  - staff-…  → staff
 *  - store-…  → store
 *  - 그 외    → customer
 *
 * 운영 도메인 (자체 도메인) 으로 전환 시:
 *  - 자체 도메인 환경변수 사용 (예: NEXT_PUBLIC_HOST_ADMIN=admin.funnyview.kr)
 *  - 본 모듈 resolvePortal() 에 host 매칭 로직만 추가
 */

export type Portal = 'customer' | 'admin' | 'staff' | 'store';

const HOST_OVERRIDES: Record<string, Portal> = {
  // 자체 도메인 사용 시 ENV 로 정의된 host 매핑
  ...(process.env.NEXT_PUBLIC_HOST_ADMIN
    ? { [process.env.NEXT_PUBLIC_HOST_ADMIN]: 'admin' as const }
    : {}),
  ...(process.env.NEXT_PUBLIC_HOST_STAFF
    ? { [process.env.NEXT_PUBLIC_HOST_STAFF]: 'staff' as const }
    : {}),
  ...(process.env.NEXT_PUBLIC_HOST_STORE
    ? { [process.env.NEXT_PUBLIC_HOST_STORE]: 'store' as const }
    : {}),
};

export function resolvePortal(host: string | null | undefined): Portal {
  const h = (host || '').toLowerCase().split(':')[0]; // 포트 제거

  if (HOST_OVERRIDES[h]) return HOST_OVERRIDES[h];

  if (h.startsWith('admin-') || h.startsWith('admin.')) return 'admin';
  if (h.startsWith('staff-') || h.startsWith('staff.')) return 'staff';
  if (h.startsWith('store-') || h.startsWith('store.')) return 'store';
  return 'customer';
}

/**
 * Portal 별 메인 진입 path (로그인 안 된 상태에서 / 진입 시 이동할 경로).
 */
export function portalEntryPath(portal: Portal): string {
  switch (portal) {
    case 'admin':
      return '/login/admin';
    case 'staff':
      return '/login/warehouse';
    case 'store':
      return '/login/store';
    case 'customer':
      return '/';
  }
}

/**
 * Portal 별 허용 path prefix.
 * 'all' = portal 무관 항상 허용 (정적 자산, 공통 API, 헬스체크 등).
 */
const PORTAL_ALLOWED: Record<Portal, string[]> = {
  customer: [
    '/',
    '/customer',
    '/login', // 일반 로그인 (소셜)
    '/register',
    '/onboarding',
    '/order',
    '/my',
    '/stores', // 매장찾기 공개 페이지 (추후 추가 시)
    '/api/auth',
    '/api/orders',
    '/api/lenses',
    '/api/stores',
    '/api/home',
    '/api/notifications',
    '/api/push',
    '/api/events',
  ],
  admin: ['/admin', '/login/admin', '/api/admin', '/api/auth'],
  staff: [
    '/warehouse',
    '/login/warehouse',
    '/api/warehouse',
    '/api/auth',
    '/api/notifications',
    '/api/push',
    '/api/events',
  ],
  store: [
    '/store',
    '/login/store',
    '/api/store',
    '/api/auth',
    '/api/notifications',
    '/api/push',
    '/api/events',
  ],
};

/**
 * 모든 portal 에서 항상 허용 (정적 자산은 matcher 에서 제외되어 여기 도달 안 함).
 */
const ALWAYS_ALLOWED = [
  '/api/health',
  '/manifest.json',
  '/sw.js',
  '/favicon.ico',
  '/robots.txt',
];

export function isPathAllowedOnPortal(portal: Portal, pathname: string): boolean {
  if (ALWAYS_ALLOWED.includes(pathname)) return true;
  const allowed = PORTAL_ALLOWED[portal];
  return allowed.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

/**
 * 인증이 필요한 (보호된) path 여부.
 */
export function isProtectedPath(pathname: string): boolean {
  return (
    pathname.startsWith('/customer') ||
    pathname.startsWith('/warehouse') ||
    pathname.startsWith('/store') ||
    pathname.startsWith('/admin')
  );
}

/**
 * 로그인 페이지 URL — 보호된 path 진입 시 미인증이면 이쪽으로.
 */
export function loginUrlFor(pathname: string, search: string): string {
  const next = encodeURIComponent(pathname + search);
  if (pathname.startsWith('/admin')) return `/login/admin?next=${next}`;
  if (pathname.startsWith('/warehouse')) return `/login/warehouse?next=${next}`;
  if (pathname.startsWith('/store')) return `/login/store?next=${next}`;
  return `/login?next=${next}`;
}

/**
 * 세션의 role 이 path 에 접근할 수 있는지.
 * (Admin 은 모든 역할 path 접근 가능 — 디버깅/대행 처리용)
 */
const ROLE_PREFIX: Record<string, string[]> = {
  customer: ['/customer'],
  warehouse_staff: ['/warehouse'],
  store_staff: ['/store'],
  admin: ['/customer', '/warehouse', '/store', '/admin'],
};

export function canRoleAccess(role: string, pathname: string): boolean {
  const allowed = ROLE_PREFIX[role] ?? [];
  return allowed.some((p) => pathname === p || pathname.startsWith(p + '/'));
}
