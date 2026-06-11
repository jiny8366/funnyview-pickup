import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { storeGroups, stores } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

function isAdmin(user: { role: string; isMaster: boolean; permissions: string[] }) {
  return user.role === 'admin' || user.isMaster || user.permissions.includes('stores_write');
}

/**
 * PUT /api/admin/store-groups/[id] — 그룹 수정. admin 전용.
 *   body: { name?, commissionRate?, sortOrder?, memo? }
 */
export async function PUT(
  req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'admin only' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Partial<typeof storeGroups.$inferInsert> = {};

  if ('name' in body && typeof body.name === 'string') {
    const v = body.name.trim();
    if (v) patch.name = v;
  }
  if ('commissionRate' in body && body.commissionRate != null && body.commissionRate !== '') {
    patch.commissionRate = String(body.commissionRate);
  }
  if ('sortOrder' in body) {
    const n = typeof body.sortOrder === 'number' ? body.sortOrder : Number(body.sortOrder);
    if (!Number.isNaN(n)) patch.sortOrder = n;
  }
  if ('memo' in body) {
    const v = typeof body.memo === 'string' ? body.memo.trim() : '';
    patch.memo = v === '' ? null : v;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'NO_FIELDS' }, { status: 400 });
  }

  const [row] = await db
    .update(storeGroups)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(storeGroups.id, params.id))
    .returning();

  if (!row) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, group: row });
}

/**
 * DELETE /api/admin/store-groups/[id] — 그룹 삭제. admin 전용.
 *   소속 매장의 group_id 를 먼저 null 로 해제한 뒤 그룹 삭제.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'admin only' }, { status: 403 });
  }

  await db
    .update(stores)
    .set({ groupId: null, updatedAt: new Date() })
    .where(eq(stores.groupId, params.id));

  const [row] = await db
    .delete(storeGroups)
    .where(eq(storeGroups.id, params.id))
    .returning();

  if (!row) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
