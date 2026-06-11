import { NextResponse } from 'next/server';
import { asc, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { storeGroups, stores } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

function isAdmin(user: { role: string; isMaster: boolean; permissions: string[] }) {
  return user.role === 'admin' || user.isMaster || user.permissions.includes('stores_write');
}

/**
 * GET /api/admin/store-groups — 그룹 목록 (각 memberCount 포함). admin 전용.
 *   정렬: sortOrder ASC, name ASC
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'admin only' }, { status: 403 });
  }

  const rows = await db
    .select({
      id: storeGroups.id,
      name: storeGroups.name,
      commissionRate: storeGroups.commissionRate,
      sortOrder: storeGroups.sortOrder,
      memo: storeGroups.memo,
      createdAt: storeGroups.createdAt,
      updatedAt: storeGroups.updatedAt,
      memberCount: sql<number>`COUNT(${stores.id})::int`,
    })
    .from(storeGroups)
    .leftJoin(stores, eq(stores.groupId, storeGroups.id))
    .groupBy(storeGroups.id)
    .orderBy(asc(storeGroups.sortOrder), asc(storeGroups.name));

  return NextResponse.json({ groups: rows });
}

/**
 * POST /api/admin/store-groups — 그룹 생성. admin 전용.
 *   body: { name(필수), commissionRate?, sortOrder?, memo? }
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'admin only' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'name required' }, { status: 400 });
  }

  const [row] = await db
    .insert(storeGroups)
    .values({
      name,
      commissionRate:
        body.commissionRate != null && body.commissionRate !== ''
          ? String(body.commissionRate)
          : '0',
      sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : Number(body.sortOrder) || 0,
      memo: typeof body.memo === 'string' && body.memo.trim() ? body.memo.trim() : null,
    })
    .returning();

  return NextResponse.json({ ok: true, group: row }, { status: 201 });
}
