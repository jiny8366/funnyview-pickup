import { NextResponse } from 'next/server';
import { and, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { inventory, inventoryMovements, lensVariants, lenses } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { withDbRetry } from '@/lib/db/retry';
import {
  SAFETY_STOCK_PARAMS,
  adviseSafetyStock,
} from '@/lib/inventory/safety-stock';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return null;
  return user;
}

/**
 * 안전재고량 관리 (JINY) — 제품 검색 또는 전체 권고 리스트.
 * 권고 산출: 표준 재고이론 SS = Z·σd·√LT — src/lib/inventory/safety-stock.ts 기준 참조.
 *
 * GET ?q=제품명/브랜드  → 해당 제품의 도수별 현재고/안전재고/권고
 * GET ?all=1           → 전체 품목 중 (판매이력·현재고·안전재고 있는 도수) 권고 리스트, 권고 desc
 */
export async function GET(req: Request) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim();
  const all = url.searchParams.get('all') === '1';
  if (!q && !all) return NextResponse.json({ rows: [], params: SAFETY_STOCK_PARAMS });

  // 관측창 내 일별 출고(outbound: 고객 배송 + B2B 발주) 집계 — σ 계산용 Σq² 포함
  const windowDays = SAFETY_STOCK_PARAMS.windowDays;
  const daily = db
    .select({
      variantId: inventoryMovements.variantId,
      q: sql<number>`SUM(ABS(${inventoryMovements.quantity}))`.as('q'),
    })
    .from(inventoryMovements)
    .where(
      sql`${inventoryMovements.movementType} = 'outbound' AND ${inventoryMovements.performedAt} >= now() - make_interval(days => ${windowDays})`,
    )
    .groupBy(inventoryMovements.variantId, sql`date_trunc('day', ${inventoryMovements.performedAt})`)
    .as('s');

  const demand = db
    .select({
      variantId: daily.variantId,
      totalQty: sql<number>`SUM(${daily.q})::int`.as('total_qty'),
      saleDays: sql<number>`COUNT(*)::int`.as('sale_days'),
      sumSq: sql<number>`SUM(${daily.q} * ${daily.q})::float`.as('sum_sq'),
    })
    .from(daily)
    .groupBy(daily.variantId)
    .as('demand');

  const conds = [eq(lensVariants.isActive, true), sql`${lenses.deletedAt} IS NULL`];
  if (q) {
    const pat = `%${q}%`;
    const search = or(ilike(lenses.name, pat), ilike(lenses.brand, pat), ilike(lensVariants.sku, pat));
    if (search) conds.push(search);
  }
  if (all) {
    // 전체 모드: 의미 있는 행만 (판매이력 또는 현재고/안전재고 보유)
    conds.push(
      sql`(COALESCE(${demand.totalQty}, 0) > 0 OR COALESCE(${inventory.quantityOnHand}, 0) > 0 OR COALESCE(${inventory.safetyStock}, 0) > 0)`,
    );
  }

  const rows = await withDbRetry(() =>
    db
      .select({
        variantId: lensVariants.id,
        sku: lensVariants.sku,
        brand: lenses.brand,
        lensName: lenses.name,
        replacementCycle: lenses.replacementCycle,
        piecesPerBox: lenses.piecesPerBox,
        sphere: lensVariants.sphere,
        cylinder: lensVariants.cylinder,
        axis: lensVariants.axis,
        addPower: lensVariants.addPower,
        onHand: sql<number>`COALESCE(${inventory.quantityOnHand}, 0)`,
        safetyStock: sql<number>`COALESCE(${inventory.safetyStock}, 0)`,
        totalQty: sql<number>`COALESCE(${demand.totalQty}, 0)`,
        saleDays: sql<number>`COALESCE(${demand.saleDays}, 0)`,
        sumSq: sql<number>`COALESCE(${demand.sumSq}, 0)`,
      })
      .from(lensVariants)
      .innerJoin(lenses, eq(lenses.id, lensVariants.lensId))
      .leftJoin(inventory, eq(inventory.variantId, lensVariants.id))
      .leftJoin(demand, eq(demand.variantId, lensVariants.id))
      .where(and(...conds))
      .orderBy(
        sql`COALESCE(${demand.totalQty}, 0) DESC`,
        lenses.brand,
        lenses.name,
        lensVariants.sphere,
      )
      .limit(all ? 500 : 2000),
  );

  const out = rows.map((r) => {
    const advice = adviseSafetyStock({ totalQty: r.totalQty, saleDays: r.saleDays, sumSq: r.sumSq });
    return {
      variantId: r.variantId,
      sku: r.sku,
      brand: r.brand,
      lensName: r.lensName,
      replacementCycle: r.replacementCycle,
      piecesPerBox: r.piecesPerBox,
      sphere: r.sphere,
      cylinder: r.cylinder,
      axis: r.axis,
      addPower: r.addPower,
      onHand: r.onHand,
      safetyStock: r.safetyStock,
      sold30d: r.totalQty,
      recommended: advice.recommended,
      reorderPoint: advice.reorderPoint,
      method: advice.method,
    };
  });

  return NextResponse.json({ rows: out, params: SAFETY_STOCK_PARAMS });
}

const patchSchema = z.object({
  variantId: z.string().uuid(),
  safetyStock: z.number().int().min(0),
});

/** 안전재고 셀 클릭 편집 / 권고 적용 — admin 전용 */
export async function PATCH(req: Request) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });

  const { setInventoryLevels } = await import('@/lib/inventory-levels');
  await setInventoryLevels({
    variantId: parsed.data.variantId,
    safetyStock: parsed.data.safetyStock,
    byUserId: me.id,
    note: '안전재고량 관리 화면',
  });
  return NextResponse.json({ ok: true });
}
