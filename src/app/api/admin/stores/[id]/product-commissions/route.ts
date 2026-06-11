import { NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  groupProductCommissions,
  lenses,
  storeProductCommissionHistory,
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

  // 이전 값(있으면 update, 없으면 set) + 제품 스냅샷 조회 — 이력 기록용
  const [existing] = await db
    .select({ commissionRate: storeProductCommissions.commissionRate })
    .from(storeProductCommissions)
    .where(
      and(
        eq(storeProductCommissions.storeId, params.id),
        eq(storeProductCommissions.lensId, lensId),
      ),
    )
    .limit(1);
  const [lens] = await db
    .select({ brand: lenses.brand, name: lenses.name })
    .from(lenses)
    .where(eq(lenses.id, lensId))
    .limit(1);

  const [row] = await db
    .insert(storeProductCommissions)
    .values({ storeId: params.id, lensId, commissionRate: rate })
    .onConflictDoUpdate({
      target: [storeProductCommissions.storeId, storeProductCommissions.lensId],
      set: { commissionRate: rate, updatedAt: new Date() },
    })
    .returning();

  // 변경이력 기록 (스냅샷)
  await db.insert(storeProductCommissionHistory).values({
    storeId: params.id,
    lensId,
    brand: lens?.brand ?? null,
    productName: lens?.name ?? null,
    action: existing ? 'update' : 'set',
    oldRate: existing?.commissionRate ?? null,
    newRate: rate,
    changedBy: user.id,
  });

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

  // 삭제 전 값/스냅샷 조회 — 이력 기록용
  const [existing] = await db
    .select({ commissionRate: storeProductCommissions.commissionRate })
    .from(storeProductCommissions)
    .where(
      and(
        eq(storeProductCommissions.storeId, params.id),
        eq(storeProductCommissions.lensId, lensId),
      ),
    )
    .limit(1);
  const [lens] = await db
    .select({ brand: lenses.brand, name: lenses.name })
    .from(lenses)
    .where(eq(lenses.id, lensId))
    .limit(1);

  await db
    .delete(storeProductCommissions)
    .where(
      and(
        eq(storeProductCommissions.storeId, params.id),
        eq(storeProductCommissions.lensId, lensId),
      ),
    );

  // 실제로 오버라이드가 있었던 경우에만 이력 기록
  if (existing) {
    await db.insert(storeProductCommissionHistory).values({
      storeId: params.id,
      lensId,
      brand: lens?.brand ?? null,
      productName: lens?.name ?? null,
      action: 'delete',
      oldRate: existing.commissionRate,
      newRate: null,
      changedBy: user.id,
    });
  }

  return NextResponse.json({ ok: true });
}
