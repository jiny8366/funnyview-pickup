/**
 * 권한 기반 가드.
 *
 * frame-ops 의 보안 원칙 채택 (확정 2026-05-19):
 *  - 클라이언트만 가드 X — 메뉴 숨기기는 보조, 페이지 + API 양쪽 필수
 *  - JWT 에 민감 정보 X — permissions 는 DB 조회 (getCurrentUser)
 *  - middleware 만 가드 X — API 별 미세 차이 표현 불가
 *
 * 사용 패턴:
 *  - 페이지 server component: const me = await requirePermissionOrRedirect('staff_read')
 *  - API 라우트: const me = await requirePermissionForApi('staff_manage'); if (!me) return 403
 */
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser, type CurrentUser } from './current-user';
import { hasPermission } from './permissions';

/** 권한 체크 (마스터 자동 통과). */
export function userHasPermissionOrIsMaster(
  user: CurrentUser | null | undefined,
  slug: string,
): boolean {
  if (!user) return false;
  if (user.isMaster) return true;
  return hasPermission(user.permissions, slug);
}

/**
 * 페이지 server component 용 — 권한 없으면 notFound.
 * 비로그인이면 /login/admin 으로 redirect.
 */
export async function requirePermissionOrRedirect(slug: string): Promise<CurrentUser> {
  const me = await getCurrentUser();
  if (!me) {
    redirect('/login/admin');
  }
  if (me.role !== 'admin') {
    redirect('/');
  }
  if (!userHasPermissionOrIsMaster(me, slug)) {
    notFound();
  }
  return me;
}

/**
 * API 라우트 용 — 권한 체크 후 null/user 반환.
 * 호출 측에서 null 이면 403 응답.
 */
export async function requirePermissionForApi(
  slug: string,
): Promise<CurrentUser | null> {
  const me = await getCurrentUser();
  if (!me) return null;
  if (me.role !== 'admin') return null;
  if (!userHasPermissionOrIsMaster(me, slug)) return null;
  return me;
}
