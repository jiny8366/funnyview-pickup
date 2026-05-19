/**
 * RBAC 권한 슬러그 정의.
 *
 * frame-ops 의 lib/auth/permissions.ts 패턴 채택:
 *  - 권한 키 = snake_case `<domain>_<action>`
 *  - users.permissions text[]: NULL = role 기본값 (ROLE_DEFAULTS) 사용, 배열 = override
 *  - admin role 은 ROLE_DEFAULTS 에서 전권 받음 → 별도 분기 불필요
 *
 * 이 chunk (Phase C1) 는 admin portal 메뉴 기준 16개 키.
 * warehouse / store portal 권한은 Phase C3 에서 추가.
 */

export type PermissionGroup =
  | '운영'
  | '상품'
  | '가맹점'
  | 'CMS·마케팅'
  | '시스템';

export interface PermissionDef {
  key: string;
  label: string;
  group: PermissionGroup;
}

export const ALL_PERMISSIONS: PermissionDef[] = [
  // 운영
  { key: 'dashboard_view', label: '대시보드 조회', group: '운영' },
  { key: 'orders_read', label: '주문 조회', group: '운영' },
  { key: 'orders_write', label: '주문 처리 (상태 변경/취소)', group: '운영' },
  { key: 'settlement_read', label: '정산/매출 조회', group: '운영' },
  { key: 'staff_read', label: '계정 조회', group: '운영' },
  { key: 'staff_manage', label: '계정 신규/변경 (비밀번호 reset 포함)', group: '운영' },
  { key: 'staff_permissions', label: '계정 권한 설정 (위임)', group: '운영' },

  // 상품
  { key: 'products_read', label: '제품 조회', group: '상품' },
  { key: 'products_write', label: '제품 등록/수정', group: '상품' },
  { key: 'categories_write', label: '카테고리 관리', group: '상품' },

  // 가맹점
  { key: 'stores_read', label: '가맹점 조회', group: '가맹점' },
  { key: 'stores_write', label: '가맹점 등록/수정', group: '가맹점' },

  // CMS·마케팅
  { key: 'home_sections_read', label: '홈 섹션 조회', group: 'CMS·마케팅' },
  { key: 'home_sections_write', label: '홈 섹션 편집', group: 'CMS·마케팅' },
  { key: 'home_analytics_view', label: '섹션 분석 조회', group: 'CMS·마케팅' },

  // 시스템
  { key: 'settings_write', label: '시스템 설정 변경', group: '시스템' },
];

export const PERMISSION_KEYS = ALL_PERMISSIONS.map((p) => p.key);

export const PERMISSION_GROUPS: PermissionGroup[] = [
  '운영',
  '상품',
  '가맹점',
  'CMS·마케팅',
  '시스템',
];

/**
 * Role 별 기본 권한.
 * NULL 인 users.permissions 는 이 값을 사용.
 *
 * frame-ops 의 ROLE_DEFAULTS 와 같은 의미. DB 에 저장하지 않음 (git log 추적용).
 *
 * - admin: 전권. permissions=null 인 admin 은 모든 키 자동 부여.
 * - warehouse_staff / store_staff / customer: admin portal 권한 없음.
 *   warehouse/store portal 의 권한은 Phase C3 에서 별도 정의.
 */
export const ROLE_DEFAULTS: Record<string, string[]> = {
  admin: PERMISSION_KEYS,
  warehouse_staff: [],
  store_staff: [],
  customer: [],
};

/**
 * 사용자의 effective permissions 산출.
 *  - explicit (users.permissions) 가 배열이면 그대로 사용 (override)
 *  - NULL / undefined 면 ROLE_DEFAULTS 사용
 */
export function effectivePermissions(
  role: string,
  explicit: string[] | null | undefined,
): string[] {
  if (Array.isArray(explicit) && explicit.length > 0) return explicit;
  return ROLE_DEFAULTS[role] ?? [];
}

/**
 * 단일 권한 키 보유 여부.
 */
export function hasPermission(
  perms: string[] | undefined | null,
  key: string,
): boolean {
  return Array.isArray(perms) && perms.includes(key);
}
