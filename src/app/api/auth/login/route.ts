import { NextResponse } from 'next/server';
import { and, eq, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { verifyPassword } from '@/lib/auth/password';
import { setSessionCookie } from '@/lib/auth/session';
import { withDbRetry } from '@/lib/db/retry';
import { checkRateLimit, clientIp } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  phone: z.string().min(1), // 이메일 / 휴대전화번호 (기존 계정은 아이디도 허용)
  password: z.string().min(1),
  expectedRole: z
    .enum(['customer', 'warehouse_staff', 'store_staff', 'admin'])
    .optional(),
});

export async function POST(req: Request) {
  const parsed = loginSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }
  const { phone: identifier, password, expectedRole } = parsed.data;

  // 무차별 대입 방어: IP 10회/분 + 동일 계정식별자 5회/분 (go-live 보안)
  const ip = clientIp(req);
  const byIp = checkRateLimit(`login:ip:${ip}`, 10, 60_000);
  const byId = checkRateLimit(`login:id:${identifier.toLowerCase()}`, 5, 60_000);
  if (!byIp.allowed || !byId.allowed) {
    const retry = Math.max(byIp.retryAfterSec, byId.retryAfterSec);
    return NextResponse.json(
      { error: 'TOO_MANY_ATTEMPTS', message: `로그인 시도가 너무 많습니다. ${retry}초 후 다시 시도해주세요.` },
      { status: 429, headers: { 'Retry-After': String(retry) } },
    );
  }

  // 이메일 / phone / (기존)username 매칭 (일시적 연결 블립 시 짧게 재시도)
  const rows = await withDbRetry(() =>
    db
      .select({
        id: users.id,
        role: users.role,
        storeId: users.storeId,
        passwordHash: users.passwordHash,
        isActive: users.isActive,
      })
      .from(users)
      .where(
        and(
          or(
            eq(users.email, identifier),
            eq(users.phone, identifier),
            eq(users.username, identifier),
          ),
          isNull(users.deletedAt),
        ),
      )
      .limit(1),
  );

  const user = rows[0];
  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 });
  }
  if (!user.isActive) {
    return NextResponse.json({ error: 'INACTIVE_USER' }, { status: 403 });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 });
  }

  if (expectedRole && user.role !== expectedRole && user.role !== 'admin') {
    return NextResponse.json({ error: 'ROLE_MISMATCH' }, { status: 403 });
  }

  await setSessionCookie({
    uid: user.id,
    role: user.role,
    storeId: user.storeId,
  });

  // 로그인 기록 — 비치명적(실패해도 로그인은 성공 처리)
  try {
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  } catch (err) {
    console.error('[api/auth/login] lastLoginAt 갱신 실패(무시):', err);
  }

  return NextResponse.json({
    ok: true,
    role: user.role,
    storeId: user.storeId,
  });
}
