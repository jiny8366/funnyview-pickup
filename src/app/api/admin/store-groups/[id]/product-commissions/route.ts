import { NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { groupProductCommissions, lenses } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

function isAdmin(user: { role: string; isMaster: boolean; permissions: string[] }) {
  return user.role === 'admin' || user.isMaster || user.permissions.includes('stores_write');
}

/**
 * GET /api/admin/store-groups/[id]/product-commissions
 *   그룹의 제품별 수수료율 오버라이드 목록 (lenses 조인). admin 전용.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'admin only' }, { status: 403 });
  }

  const rows = await db
    .select({
      id: groupProductCommissions.id,
      lensId: groupProductCommissions.lensId,
      commissionRate: groupProductCommissions.commissionRate,
      brand: lenses.brand,
      name: lenses.name,
      productCode: lenses.productCode,
      updatedAt: groupProductCommissions.updatedAt,
    })
    .from(groupProductCommissions)
    .innerJoin(lenses, eq(lenses.id, groupProductCommissions.lensId))
    .where(eq(groupProductCommissions.groupId, params.id))
    .orderBy(asc(lenses.brand), asc(lenses.name));

  return NextResponse.json({ commissions: rows });
}

/**
 * POST /api/admin/store-groups/[id]/product-commissions
 *   upsert (group_id, lens_id) → commission_rate. admin 전용.
 *   body: { lensId: string, commissionRate: string|number }
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'admin only' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const lensId = typeof body.lensId === 'string' ? body.lensId.trim() : '';
  if (!lensId) {
    return NextResponse.json({ error: 'lensId required' }, { status: 400 });
  }
  if (body.commissionRate == null || body.commissionRate === '') {
    return NextResponse.json({ error: 'commissionRate required' }, { status: 400 });
  }
  const rate = String(body.commissionRate);
  if (Number.isNaN(Number(rate))) {
    return NextResponse.json({ error: 'commissionRate invalid' }, { status: 400 });
  }

  const [row] = await db
    .insert(groupProductCommissions)
    .values({ groupId: params.id, lensId, commissionRate: rate })
    .onConflictDoUpdate({
      target: [groupProductCommissions.groupId, groupProductCommissions.lensId],
      set: { commissionRate: rate, updatedAt: new Date() },
    })
    .returning();

  return NextResponse.json({ ok: true, commission: row });
}

/**
 * DELETE /api/admin/store-groups/[id]/product-commissions?lensId=...
 *   해당 그룹의 제품 오버라이드 제거. admin 전용.
 *   lensId 는 쿼리스트링 또는 body 로 전달.
 */
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'admin only' }, { status: 403 });
  }

  const url = new URL(req.url);
  let lensId = url.searchParams.get('lensId')?.trim() ?? '';
  if (!lensId) {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    lensId = typeof body.lensId === 'string' ? body.lensId.trim() : '';
  }
  if (!lensId) {
    return NextResponse.json({ error: 'lensId required' }, { status: 400 });
  }

  await db
    .delete(groupProductCommissions)
    .where(
      and(
        eq(groupProductCommissions.groupId, params.id),
        eq(groupProductCommissions.lensId, lensId),
      ),
    );

  return NextResponse.json({ ok: true });
}
