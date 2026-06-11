import { NextResponse } from 'next/server';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { inventory, inventoryLots, inventoryMovements, inboundShipments, lensVariants, lenses } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'warehouse_staff' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const url = new URL(req.url);

  // 필터 칩 구성용 facet 목록 — 어드민 제품마스터와 동일한 검색조건(브랜드·주기·갯수)
  if (url.searchParams.get('facets') === '1') {
    const live = sql`${lenses.deletedAt} IS NULL`;
    const [brandRows, cycleRows, packRows] = await Promise.all([
      db.selectDistinct({ v: lenses.brand }).from(lenses).where(live).orderBy(asc(lenses.brand)),
      db.selectDistinct({ v: lenses.replacementCycle }).from(lenses).where(live).orderBy(asc(lenses.replacementCycle)),
      db.selectDistinct({ v: lenses.piecesPerBox }).from(lenses).where(live).orderBy(asc(lenses.piecesPerBox)),
    ]);
    return NextResponse.json({
      brands: brandRows.map((b) => b.v),
      cycles: cycleRows.map((r) => r.v),
      packs: packRows.map((r) => r.v),
    });
  }

  // [임시 진단 — 재고 0건 #23] 테이블/조인 단계별 카운트. 원인 확정 후 제거.
  if (url.searchParams.get('debug') === 'count') {
    const a = await db.execute(sql`SELECT COUNT(*)::int AS c FROM inventory`);
    const b = await db.execute(sql`SELECT COUNT(*)::int AS c FROM inventory i JOIN lens_variants v ON v.id = i.variant_id`);
    const c = await db.execute(sql`SELECT COUNT(*)::int AS c FROM inventory i JOIN lens_variants v ON v.id = i.variant_id JOIN lenses l ON l.id = v.lens_id`);
    const d = await db.execute(sql`SELECT COALESCE(SUM(quantity_on_hand),0)::int AS total, COALESCE(SUM(quantity_reserved),0)::int AS reserved FROM inventory`);
    return NextResponse.json({ inventoryCount: a, joinVariants: b, joinLenses: c, sums: d });
  }

  const onlyLow = url.searchParams.get('low') === '1';
  // 검색 조건: q=제품명/SKU, brand/type 은 콤마구분 복수 선택(칩 토글) 지원
  const q = url.searchParams.get('q')?.trim();
  const brandList = (url.searchParams.get('brand') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const typeList = (url.searchParams.get('type') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const cycleList = (url.searchParams.get('cycle') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const packList = (url.searchParams.get('pack') ?? '').split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
  const format = url.searchParams.get('format'); // 'csv' = 엑셀 다운로드

  // FIFO lot aggregates via correlated subqueries (confirmed lots only)
  const lotSubquery = db
    .select({
      variantId: inventoryLots.variantId,
      lotCount: sql<number>`COUNT(*)::int`.as('lot_count'),
      weightedAvgCost: sql<number>`CASE WHEN SUM(${inventoryLots.quantityRemaining}) = 0 THEN 0 ELSE ROUND(SUM(${inventoryLots.quantityRemaining}::numeric * ${inventoryLots.unitCostIncVat}) / SUM(${inventoryLots.quantityRemaining})) END`.as('weighted_avg_cost'),
      oldestInboundDate: sql<string | null>`MIN(${inboundShipments.inboundDate})`.as('oldest_inbound_date'),
    })
    .from(inventoryLots)
    .innerJoin(inboundShipments, eq(inventoryLots.shipmentId, inboundShipments.id))
    .where(sql`${inventoryLots.quantityRemaining} > 0 AND ${inboundShipments.status} = 'confirmed'`)
    .groupBy(inventoryLots.variantId)
    .as('lot_agg');

  const rows = await db
    .select({
      inventoryId: inventory.id,
      variantId: lensVariants.id,
      sku: lensVariants.sku,
      brand: lenses.brand,
      lensName: lenses.name,
      sphere: lensVariants.sphere,
      cylinder: lensVariants.cylinder,
      axis: lensVariants.axis,
      addPower: lensVariants.addPower,
      replacementCycle: lenses.replacementCycle,
      piecesPerBox: lenses.piecesPerBox,
      lensType: lenses.lensType,
      onHand: inventory.quantityOnHand,
      reserved: inventory.quantityReserved,
      safetyStock: inventory.safetyStock,
      reorderPoint: inventory.reorderPoint,
      available: sql<number>`${inventory.quantityOnHand} - ${inventory.quantityReserved}`,
      isLow: sql<boolean>`(${inventory.quantityOnHand} - ${inventory.quantityReserved}) < GREATEST(${inventory.safetyStock}, ${inventory.reorderPoint})`,
      lotCount: sql<number>`COALESCE(${lotSubquery.lotCount}, 0)`,
      weightedAvgCost: sql<number>`COALESCE(${lotSubquery.weightedAvgCost}, 0)`,
      oldestInboundDate: lotSubquery.oldestInboundDate,
    })
    .from(inventory)
    .innerJoin(lensVariants, eq(lensVariants.id, inventory.variantId))
    .innerJoin(lenses, eq(lenses.id, lensVariants.lensId))
    .leftJoin(lotSubquery, eq(lotSubquery.variantId, lensVariants.id))
    .where(sql.join(
      [
        onlyLow
          ? sql`(${inventory.quantityOnHand} - ${inventory.quantityReserved}) < GREATEST(${inventory.safetyStock}, ${inventory.reorderPoint})`
          : sql`TRUE`,
        q ? sql`(${lenses.name} ILIKE ${'%' + q + '%'} OR ${lensVariants.sku} ILIKE ${'%' + q + '%'})` : sql`TRUE`,
        brandList.length > 0 ? inArray(lenses.brand, brandList) : sql`TRUE`,
        typeList.length > 0 ? inArray(lenses.lensType, typeList as never) : sql`TRUE`,
        cycleList.length > 0 ? inArray(lenses.replacementCycle, cycleList as never) : sql`TRUE`,
        packList.length > 0 ? inArray(lenses.piecesPerBox, packList) : sql`TRUE`,
      ],
      sql` AND `,
    ))
    .orderBy(asc(lenses.brand), asc(lenses.name), asc(lensVariants.sphere));

  // 엑셀(CSV) 다운로드 — UTF-8 BOM 으로 한글 엑셀 호환
  if (format === 'csv') {
    const header = ['브랜드', '제품명', 'SKU', 'SPH', 'CYL', 'AXIS', 'ADD', '현재고(팩)', '안전재고'];
    const lines = rows.map((r) =>
      [
        r.brand, r.lensName, r.sku, r.sphere, r.cylinder ?? '', r.axis ?? '', r.addPower ?? '',
        r.onHand, r.safetyStock,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
    const csv = '\uFEFF' + [header.join(','), ...lines].join('\r\n');
    return new NextResponse(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="inventory-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({ inventory: rows });
}

const adjustSchema = z.object({
  variantId: z.string().uuid(),
  delta: z.number().int(), // 양수: 입고, 음수: 조정 차감
  note: z.string().optional(),
});

/**
 * 입고/재고조정.
 * 단순 모델: 변경량(delta)을 quantity_on_hand 에 가산 + inventory_movements 기록.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'warehouse_staff' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const parsed = adjustSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }
  const { variantId, delta, note } = parsed.data;
  if (delta === 0) {
    return NextResponse.json({ error: 'NO_CHANGE' }, { status: 400 });
  }

  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: inventory.id })
      .from(inventory)
      .where(eq(inventory.variantId, variantId))
      .limit(1);

    if (existing[0]) {
      await tx
        .update(inventory)
        .set({
          quantityOnHand: sql`${inventory.quantityOnHand} + ${delta}`,
          lastCountedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(inventory.variantId, variantId));
    } else {
      await tx.insert(inventory).values({
        variantId,
        quantityOnHand: delta,
        quantityReserved: 0,
        safetyStock: 0,
        reorderPoint: 0,
      });
    }

    await tx.insert(inventoryMovements).values({
      variantId,
      movementType: delta > 0 ? 'inbound' : 'adjust',
      quantity: delta,
      note,
      performedBy: user.id,
    });
  });

  return NextResponse.json({ ok: true });
}
