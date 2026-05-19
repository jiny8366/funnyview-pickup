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
  { key: 'price_history_view', label: '가격변동이력 조회/다운로드', group: '상품' },
  { key: 'price_history_delete', label: '가격변동이력 삭제', group: '상품' },

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
 * - admin: [] — default 권한 없음. 마스터(env)만 전권, 그 외 admin 은 권한 편집 UI 에서 명시 부여.
 *   (확정 2026-05-19: 사용자 요구 "마스터에만 모든 메뉴 접근")
 * - warehouse_staff / store_staff / customer: admin portal 권한 없음.
 *   warehouse/store portal 의 권한은 Phase C3 에서 별도 정의.
 */
export const ROLE_DEFAULTS: Record<string, string[]> = {
  admin: [],
  warehouse_staff: [],
  store_staff: [],
  customer: [],
};

/**
 * 사용자의 effective permissions 산출.
 *  - 마스터 사용자 (username ∈ MASTER_USERNAMES) → 항상 전권 (PERMISSION_KEYS)
 *  - explicit (users.permissions) 가 배열이면 그대로 사용 (override)
 *  - NULL / undefined 면 ROLE_DEFAULTS 사용
 */
export function effectivePermissions(
  role: string,
  explicit: string[] | null | undefined,
  username?: string | null,
  phone?: string | null,
): string[] {
  if (isMasterUser(username, phone)) return PERMISSION_KEYS;
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

/**
 * 마스터 사용자 — 모든 권한 자동 부여 + role/permissions 변경 차단.
 *
 * 환경변수 MASTER_USERNAMES (콤마 구분) 로 운영 환경마다 다른 화이트리스트 가능.
 * 미설정 시 production 기본값으로 jiny8366 단일 사용자.
 *
 * 권한 슬러그가 아닌 username 기반 — 이유:
 *  1) 슬러그면 다른 admin 의 권한 편집 UI 에 노출되어 실수/악의로 부여 위험
 *  2) env 는 환경 단위 통제 가능 + 코드 검토 시 변경 이력 명확
 *  3) 데이터 모델 변경 없음 (role enum 추가 불필요)
 */
const DEFAULT_MASTER_USERNAMES = ['jiny8366'];

function getMasterUsernames(): string[] {
  const env = process.env.MASTER_USERNAMES;
  if (env && env.trim()) {
    return env
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return DEFAULT_MASTER_USERNAMES;
}

export function isMasterUser(
  username: string | null | undefined,
  phone?: string | null,
): boolean {
  const masters = getMasterUsernames();
  if (username && masters.includes(username)) return true;
  // seed 의 ensureUser 는 'jiny8366' 을 phone 컬럼에 저장 (username NULL).
  // 마스터 식별자가 phone 으로 들어와도 매칭하도록 fallback.
  if (phone && masters.includes(phone)) return true;
  return false;
}
