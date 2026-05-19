import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { lensPriceEntries } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { hasPermission } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  // 마스터 또는 price_history_delete 권한 보유자만
  if (!me.isMaster && !hasPermission(me.permissions, 'price_history_delete')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  await db
    .update(lensPriceEntries)
    .set({ deletedAt: new Date() })
    .where(eq(lensPriceEntries.id, params.id));

  return NextResponse.json({ ok: true });
}
