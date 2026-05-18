import { NextResponse, type NextRequest } from 'next/server';
import { verifySession } from '@/lib/auth/jwt';
import {
  canRoleAccess,
  isPathAllowedOnPortal,
  isProtectedPath,
  loginUrlFor,
  portalEntryPath,
  resolvePortal,
} from '@/lib/portal';

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? 'funnyview_pickup_session';

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const portal = resolvePortal(req.headers.get('host'));

  // [1] Portal 별 허용 path 검사 — admin/staff/store host 에서 다른 영역 접근 차단
  if (!isPathAllowedOnPortal(portal, pathname)) {
    return NextResponse.redirect(new URL(portalEntryPath(portal), req.url));
  }

  // [2] 비고객 portal 에서 / 진입 시 해당 로그인 페이지로
  if (portal !== 'customer' && pathname === '/') {
    return NextResponse.redirect(new URL(portalEntryPath(portal), req.url));
  }

  // [3] 인증 보호 path — 토큰 + 역할 검사
  if (isProtectedPath(pathname)) {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.redirect(new URL(loginUrlFor(pathname, search), req.url));
    }

    const session = await verifySession(token);
    if (!session) {
      return NextResponse.redirect(new URL(loginUrlFor(pathname, search), req.url));
    }

    if (!canRoleAccess(session.role, pathname)) {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  return NextResponse.next();
}

// 모든 path 에서 실행 (정적 자산 + 일부 공개 API 제외).
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|_next/data|favicon\\.ico|manifest\\.json|sw\\.js|icons/|uploads/|images/).*)',
  ],
};
