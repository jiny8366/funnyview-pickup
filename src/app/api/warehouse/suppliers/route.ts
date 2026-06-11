import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { suppliers } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { withDbRetry } from '@/lib/db/retry';

export const dynamic = 'force-dynamic';

/**
 * 활성 매입처 목록 — 픽업서비스(staff) 포털 입고 화면용.
 * /api/admin/suppliers 는 staff 포털 allowlist 밖이라 staff 호스트에서 호출 불가
 * (미들웨어가 로그인 HTML 로 redirect → 드롭다운이 빈 채 깨짐) → 별도 제공.
 */
export async function GET() {
  const me = await getCurrentUser();
  if (!me || (me.role !== 'warehouse_staff' && me.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const rows = await withDbRetry(() =>
    db
      .select({ id: suppliers.id, name: suppliers.name })
      .from(suppliers)
      .where(eq(suppliers.isActive, true))
      .orderBy(asc(suppliers.name)),
  );
  return NextResponse.json({ suppliers: rows });
}
