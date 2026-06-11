import { NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  groupProductCommissions,
  lenses,
  storeProductCommissions,
  stores,
} from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

function isAdmin(user: { role: string; isMaster: boolean; permissions: string[] }) {
  return user.role === 'admin' || user.isMaster || user.permissions.includes('stores_write');
}

/**
 * GET /api/admin/stores/[id]/product-commissions
 *   매장의 제품별 수수료율 오버라이드 목록. 각 행에 상속값(그룹×제품) 참고치 포함.
 *   admin 전용.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'admin only' }, { status: 403 });
  }

  const [store] = await db
    .select({ groupId: stores.groupId })
    .from(stores)
    .where(eq(stores.id, params.id))
    .limit(1);
  const groupId = store?.groupId ?? null;

  const rows = await db
    .select({
      id: storeProductCommissions.id,
      lensId: storeProductCommissions.lensId,
      commissionRate: storeProductCommissions.commissionRate,
      brand: lenses.brand,
      name: lenses.name,
      productCode: lenses.productCode,
      updatedAt: storeProductCommissions.updatedAt,
    })
    .from(storeProductCommissions)
    .innerJoin(lenses, eq(lenses.id, storeProductCommissions.lensId))
    .where(eq(storeProductCommissions.storeId, params.id))
    .orderBy(asc(lenses.brand), asc(lenses.name));

  // 상속값(그룹×제품 오버라이드)을 참조용으로 함께 반환 — 매장 소속 그룹이 있을 때만.
  let groupOverrides: Record<string, string> = {};
  if (groupId) {
    const gr = await db
      .select({
        lensId: groupProductCommissions.lensId,
        commissionRate: groupProductCommissions.commissionRate,
      })
      .from(groupProductCommissions)
      .where(eq(groupProductCommissions.groupId, groupId));
    groupOverrides = Object.fromEntries(
      gr.map((g) => [g.lensId, g.commissionRate]),
    );
  }

  const commissions = rows.map((r) => ({
    ...r,
    inheritedGroupProductRate: groupOverrides[r.lensId] ?? null,
  }));

  return NextResponse.json({ commissions });
}

/**
 * POST /api/admin/stores/[id]/product-commissions
 *   upsert (store_id, lens_id) → commission_rate. admin 전용.
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
    .insert(storeProductCommissions)
    .values({ storeId: params.id, lensId, commissionRate: rate })
    .onConflictDoUpdate({
      target: [storeProductCommissions.storeId, storeProductCommissions.lensId],
      set: { commissionRate: rate, updatedAt: new Date() },
    })
    .returning();

  return NextResponse.json({ ok: true, commission: row });
}

/**
 * DELETE /api/admin/stores/[id]/product-commissions?lensId=...
 *   해당 매장의 제품 오버라이드 제거. admin 전용.
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
    .delete(storeProductCommissions)
    .where(
      and(
        eq(storeProductCommissions.storeId, params.id),
        eq(storeProductCommissions.lensId, lensId),
      ),
    );

  return NextResponse.json({ ok: true });
}
