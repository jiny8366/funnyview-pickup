import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { businessInfo } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

/**
 * 사업장(발행자) 정보 singleton(id=1) 조회/수정 — admin 전용. (보드 #18)
 * 거래명세서/송장 발행자, 푸터 사업자표기의 단일 출처.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const [row] = await db.select().from(businessInfo).where(eq(businessInfo.id, 1)).limit(1);
  return NextResponse.json({ businessInfo: row ?? null });
}

// notNull(빈값 시 기본 유지) vs nullable
const NULLABLE = ['bizNo', 'ceo', 'address', 'phone', 'email', 'mailOrderNo', 'privacyOfficer', 'sealUrl'] as const;
const REQUIRED = ['companyName', 'serviceName'] as const;

export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const patch: Partial<typeof businessInfo.$inferInsert> = {};
  for (const f of NULLABLE) {
    if (f in body) {
      const v = typeof body[f] === 'string' ? (body[f] as string).trim() : '';
      patch[f] = v === '' ? null : v;
    }
  }
  for (const f of REQUIRED) {
    if (f in body && typeof body[f] === 'string') {
      const v = (body[f] as string).trim();
      if (v) patch[f] = v; // 빈값은 무시(기본 유지)
    }
  }

  await db
    .insert(businessInfo)
    .values({ id: 1, ...patch })
    .onConflictDoUpdate({ target: businessInfo.id, set: { ...patch, updatedAt: new Date() } });

  const [row] = await db.select().from(businessInfo).where(eq(businessInfo.id, 1)).limit(1);
  return NextResponse.json({ ok: true, businessInfo: row });
}
