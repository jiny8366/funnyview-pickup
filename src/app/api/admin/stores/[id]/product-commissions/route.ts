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
      supplyPrice: storeProductCommissions.supplyPrice,
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
  let groupOverrides: Record<string, { rate: string; supplyPrice: string | null }> = {};
  if (groupId) {
    const gr = await db
      .select({
        lensId: groupProductCommissions.lensId,
        commissionRate: groupProductCommissions.commissionRate,
        supplyPrice: groupProductCommissions.supplyPrice,
      })
      .from(groupProductCommissions)
      .where(eq(groupProductCommissions.groupId, groupId));
    groupOverrides = Object.fromEntries(
      gr.map((g) => [g.lensId, { rate: g.commissionRate, supplyPrice: g.supplyPrice }]),
    );
  }

  const commissions = rows.map((r) => ({
    ...r,
    inheritedGroupProductRate: groupOverrides[r.lensId]?.rate ?? null,
    inheritedGroupProductSupplyPrice: groupOverrides[r.lensId]?.supplyPrice ?? null,
  }));

  return NextResponse.json({ commissions });
}

/**
 * POST /api/admin/stores/[id]/product-commissions
 *   upsert (store_id, lens_id) → 할인율(commission_rate) + 공급가(supply_price). admin 전용.
 *
 *   body: {
 *     lensIds: string[]   // (또는 단일 lensId: string)
 *     discountRate?: number|string|null  // 가맹점 할인율(%) — commission_rate 컬럼에 기록
 *     supplyPrice?: number|string|null   // 가맹점 공급가(원)
 *   }
 *   discountRate / supplyPrice 중 최소 하나는 필수. 선택한 모든 lensId 에 동일 값을 일괄 적용.
 *   각 제품마다 변경이력(set/update)을 기록한다(할인율 + 공급가 old/new 스냅샷).
 *
 *   하위호환: 기존 { lensId, commissionRate } 바디도 그대로 동작한다.
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

  // lensIds (배열) 또는 단일 lensId 수용
  const lensIds: string[] = Array.isArray(body.lensIds)
    ? (body.lensIds as unknown[]).filter((v): v is string => typeof v === 'string' && v.trim() !== '').map((v) => v.trim())
    : typeof body.lensId === 'string' && body.lensId.trim() !== ''
      ? [body.lensId.trim()]
      : [];
  if (lensIds.length === 0) {
    return NextResponse.json({ error: 'lensIds required' }, { status: 400 });
  }

  // 할인율: discountRate 우선, 없으면 하위호환 commissionRate
  const rawRate = body.discountRate ?? body.commissionRate;
  const hasRate = rawRate != null && rawRate !== '';
  const rate = hasRate ? String(rawRate) : null;
  if (rate != null && Number.isNaN(Number(rate))) {
    return NextResponse.json({ error: 'discountRate invalid' }, { status: 400 });
  }

  // 공급가
  const hasSupply = body.supplyPrice != null && body.supplyPrice !== '';
  const supplyPrice = hasSupply ? String(body.supplyPrice) : null;
  if (supplyPrice != null && Number.isNaN(Number(supplyPrice))) {
    return NextResponse.json({ error: 'supplyPrice invalid' }, { status: 400 });
  }

  if (rate == null && supplyPrice == null) {
    return NextResponse.json(
      { error: 'discountRate or supplyPrice required' },
      { status: 400 },
    );
  }

  // commission_rate 컬럼은 NOT NULL — 할인율 미입력 시 기존값 유지, 신규는 0 으로.
  const results = [];
  for (const lensId of lensIds) {
    const [existing] = await db
      .select({
        commissionRate: storeProductCommissions.commissionRate,
        supplyPrice: storeProductCommissions.supplyPrice,
      })
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

    // 적용 값 — 할인율 미입력이면 기존값(신규면 '0') 유지, 공급가 미입력이면 기존값 유지.
    const effectiveRate = rate ?? existing?.commissionRate ?? '0';
    const effectiveSupply = supplyPrice ?? existing?.supplyPrice ?? null;

    const [row] = await db
      .insert(storeProductCommissions)
      .values({ storeId: params.id, lensId, commissionRate: effectiveRate, supplyPrice: effectiveSupply })
      .onConflictDoUpdate({
        target: [storeProductCommissions.storeId, storeProductCommissions.lensId],
        set: { commissionRate: effectiveRate, supplyPrice: effectiveSupply, updatedAt: new Date() },
      })
      .returning();
    results.push(row);

    await db.insert(storeProductCommissionHistory).values({
      storeId: params.id,
      lensId,
      brand: lens?.brand ?? null,
      productName: lens?.name ?? null,
      action: existing ? 'update' : 'set',
      oldRate: existing?.commissionRate ?? null,
      newRate: effectiveRate,
      oldSupplyPrice: existing?.supplyPrice ?? null,
      newSupplyPrice: effectiveSupply,
      changedBy: user.id,
    });
  }

  return NextResponse.json({ ok: true, count: results.length, commissions: results });
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
    .select({
      commissionRate: storeProductCommissions.commissionRate,
      supplyPrice: storeProductCommissions.supplyPrice,
    })
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
      oldSupplyPrice: existing.supplyPrice,
      newSupplyPrice: null,
      changedBy: user.id,
    });
  }

  return NextResponse.json({ ok: true });
}
