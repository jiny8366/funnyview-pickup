/**
 * Admin portal 의 라우트 → 필요 권한 매핑.
 *
 * frame-ops 의 ROUTE_PERMISSIONS 패턴 — longest-prefix match.
 * 더 깊은 경로가 먼저 매칭되어 강한 권한 요구 (예: /admin/staff/[id] 편집은 staff_manage).
 *
 * 이 chunk (Phase C1) 는 정의만. 실제 middleware/API 가드는 Phase C2.
 */

export const ROUTE_PERMISSIONS: Record<string, string> = {
  '/admin/dashboard': 'dashboard_view',
  '/admin/orders': 'orders_read',
  '/admin/settlement': 'settlement_read',

  '/admin/staff': 'staff_read',
  '/admin/staff/new': 'staff_manage',
  '/admin/staff/[id]': 'staff_manage',

  '/admin/products': 'products_read',
  '/admin/products/new': 'products_write',
  '/admin/products/[id]': 'products_write',
  '/admin/categories': 'categories_write',

  '/admin/stores': 'stores_read',

  '/admin/home': 'home_sections_write',
  '/admin/home/analytics': 'home_analytics_view',

  '/admin/settings': 'settings_write',
};

/**
 * pathname 에 필요한 권한 슬러그 반환 (longest-prefix match).
 *
 * Next.js 의 동적 라우트 [id] 는 패턴 매칭을 따로 처리해야 하나, 여기선
 * /admin/staff 하나로도 커버되므로 별도 패턴 분해는 생략.
 * Phase C2 (middleware 가드) 도입 시 정밀화 필요.
 */
export function requiredPermissionFor(pathname: string): string | undefined {
  const matches = Object.keys(ROUTE_PERMISSIONS)
    .filter((p) => pathname === p || pathname.startsWith(p + '/'))
    .sort((a, b) => b.length - a.length);
  return matches[0] ? ROUTE_PERMISSIONS[matches[0]] : undefined;
}
