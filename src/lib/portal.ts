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
    '/stores', // 매장찾기 공개 페이지
    '/products', // 쇼핑 페이지 (필터/검색/추천)
    '/cart', // 장바구니
    '/api/auth',
    '/api/orders',
    '/api/customer', // 고객 본인 데이터 (시력정보 등)
    '/api/lenses',
    '/api/products', // 단일 제품 상세 API
    '/api/lens-image', // 동적 SVG placeholder
    '/api/catalog', // 쇼핑 카탈로그 (컬러 메타데이터 포함)
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
const ALWAYS_ALLOWED = new Set([
  '/api/health',
  '/manifest.json',
  '/sw.js',
  '/favicon.ico',
  '/robots.txt',
]);

// Vercel Cron 및 공통 정적 자원 — portal 무관 prefix 허용
const ALWAYS_ALLOWED_PREFIX = ['/api/cron'];

// portal 별 정확 일치 (Set) + prefix 매칭 (array) 으로 분리 — 매 요청 O(1) ~ O(prefix수) 룩업
const PORTAL_EXACT: Record<Portal, Set<string>> = {
  customer: new Set(PORTAL_ALLOWED.customer),
  admin: new Set(PORTAL_ALLOWED.admin),
  staff: new Set(PORTAL_ALLOWED.staff),
  store: new Set(PORTAL_ALLOWED.store),
};

export function isPathAllowedOnPortal(portal: Portal, pathname: string): boolean {
  if (ALWAYS_ALLOWED.has(pathname)) return true;
  for (const p of ALWAYS_ALLOWED_PREFIX) {
    if (pathname === p || pathname.startsWith(p + '/')) return true;
  }
  const exact = PORTAL_EXACT[portal];
  if (exact.has(pathname)) return true;
  // prefix 매칭 — '/products' 가 allowlist 면 '/products/abc' 도 허용
  const allowed = PORTAL_ALLOWED[portal];
  for (let i = 0; i < allowed.length; i++) {
    if (pathname.startsWith(allowed[i] + '/')) return true;
  }
  return false;
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

/**
 * 현재 host 기준으로 target portal 의 URL 생성.
 *
 * 패턴:
 *  - vercel.app: 'admin-funnyview-pickup.vercel.app' ↔ 'staff-funnyview-pickup.vercel.app' 등 prefix 교체 ('-' separator)
 *  - 자체 도메인: 'admin.funnyview.kr' ↔ 'staff.funnyview.kr' ('.' separator)
 *  - ENV override: NEXT_PUBLIC_HOST_ADMIN/STAFF/STORE 가 정의되어 있으면 그 host 우선
 *  - localhost: protocol=http, separator='-' 유지
 *
 * 마스터/관리자가 다른 portal 로 이동할 때 사용. 각 portal 의 쿠키가 분리되어
 * 진입 후 그 portal 의 로그인 페이지로 redirect 되는 게 정상 동작.
 */
export function portalUrl(target: Portal, currentHost: string): string {
  const h = (currentHost || '').toLowerCase().split(':')[0];

  // ENV override 우선
  if (target === 'admin' && process.env.NEXT_PUBLIC_HOST_ADMIN) {
    return `https://${process.env.NEXT_PUBLIC_HOST_ADMIN}${portalEntryAfterLogin(target)}`;
  }
  if (target === 'staff' && process.env.NEXT_PUBLIC_HOST_STAFF) {
    return `https://${process.env.NEXT_PUBLIC_HOST_STAFF}${portalEntryAfterLogin(target)}`;
  }
  if (target === 'store' && process.env.NEXT_PUBLIC_HOST_STORE) {
    return `https://${process.env.NEXT_PUBLIC_HOST_STORE}${portalEntryAfterLogin(target)}`;
  }

  // 현재 host 의 prefix 제거하여 customer base host 추출
  let baseHost = h;
  for (const prefix of ['admin-', 'admin.', 'staff-', 'staff.', 'store-', 'store.']) {
    if (h.startsWith(prefix)) {
      baseHost = h.slice(prefix.length);
      break;
    }
  }

  const protocol = baseHost.startsWith('localhost') ? 'http' : 'https';
  const sep = baseHost.includes('vercel.app') ? '-' : '.';

  switch (target) {
    case 'customer':
      return `${protocol}://${baseHost}/`;
    case 'admin':
      return `${protocol}://admin${sep}${baseHost}/admin/home`;
    case 'staff':
      return `${protocol}://staff${sep}${baseHost}/warehouse`;
    case 'store':
      return `${protocol}://store${sep}${baseHost}/store`;
  }
}

/**
 * portalUrl 의 ENV override 케이스에서 사용할 portal 별 첫 진입 path.
 * (entryPath 는 비로그인 시 로그인 페이지를 가리키므로, 마스터/관리자
 *  바로가기는 메인 페이지로 이동해야 더 자연스러움.)
 */
function portalEntryAfterLogin(target: Portal): string {
  switch (target) {
    case 'customer':
      return '/';
    case 'admin':
      return '/admin/home';
    case 'staff':
      return '/warehouse';
    case 'store':
      return '/store';
  }
}
