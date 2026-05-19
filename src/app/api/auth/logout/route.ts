import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth/session';
import { portalEntryPath, resolvePortal } from '@/lib/portal';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  await clearSessionCookie();

  const portal = resolvePortal(req.headers.get('host'));
  const redirectTo = portalEntryPath(portal);

  // Native form submit → 브라우저가 자동으로 303 follow.
  // form submit 의 Accept 헤더에는 text/html 이 포함되지만 fetch 의 기본 Accept 는 */*.
  const accept = req.headers.get('accept') ?? '';
  if (accept.includes('text/html')) {
    return NextResponse.redirect(new URL(redirectTo, req.url), { status: 303 });
  }

  // fetch 호출 → 클라이언트가 redirectTo 로 이동
  return NextResponse.json({ ok: true, redirectTo });
}
