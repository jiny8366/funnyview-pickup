import { NextResponse } from 'next/server';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import {
  inventory,
  inventoryMovements,
  lensVariants,
  lenses,
  supplierOrderItems,
  supplierOrders,
  suppliers,
} from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { withDbRetry } from '@/lib/db/retry';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return null;
  return user;
}

/**
 * 매입 관리 (JINY) — 본사 → 매입처 발주.
 * GET ?list=1&status=        → 발주서 목록
 * GET ?candidates=1[&supplierId=] → 보충 후보: 최근 출고분 + 안전재고 미달,
 *                              ordered 발주에 이미 포함된 도수는 제외.
 *                              supplierId 지정 시 그 매입처 입고이력 제품 우선 필터.
 */
export async function GET(req: Request) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const url = new URL(req.url);

  if (url.searchParams.get('list') === '1') {
    const status = url.searchParams.get('status');
    const conds = status ? [eq(supplierOrders.status, status)] : [];
    const rows = await withDbRetry(() =>
      db
        .select({
          id: supplierOrders.id,
          orderNumber: supplierOrders.orderNumber,
          status: supplierOrders.status,
          totalCost: supplierOrders.totalCost,
          note: supplierOrders.note,
          createdAt: supplierOrders.createdAt,
          receivedAt: supplierOrders.receivedAt,
          supplierId: supplierOrders.supplierId,
          supplierName: suppliers.name,
          itemCount: sql<number>`(SELECT COALESCE(SUM(quantity),0) FROM supplier_order_items i WHERE i.order_id = ${supplierOrders.id})::int`,
          skuCount: sql<number>`(SELECT COUNT(*) FROM supplier_order_items i WHERE i.order_id = ${supplierOrders.id})::int`,
        })
        .from(supplierOrders)
        .leftJoin(suppliers, eq(suppliers.id, supplierOrders.supplierId))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(supplierOrders.createdAt))
        .limit(200),
    );
    return NextResponse.json({ orders: rows });
  }

  const isCandidates = url.searchParams.get('candidates') === '1';
  const isSearch = url.searchParams.get('search') === '1';
  if (isCandidates || isSearch) {
    const supplierId = url.searchParams.get('supplierId');

    // 최근 30일 출고량 (고객 배송 + B2B 발주)
    const sold = db
      .select({
        variantId: inventoryMovements.variantId,
        qty: sql<number>`SUM(ABS(${inventoryMovements.quantity}))::int`.as('sold_qty'),
      })
      .from(inventoryMovements)
      .where(
        sql`${inventoryMovements.movementType} = 'outbound' AND ${inventoryMovements.performedAt} >= now() - interval '30 days'`,
      )
      .groupBy(inventoryMovements.variantId)
      .as('sold');

    const orderedExpr = sql<boolean>`EXISTS (
      SELECT 1 FROM supplier_order_items soi
      JOIN supplier_orders so ON so.id = soi.order_id
      WHERE soi.variant_id = ${lensVariants.id} AND so.status = 'ordered'
    )`;

    const conds = [eq(lensVariants.isActive, true), sql`${lenses.deletedAt} IS NULL`];

    if (isCandidates) {
      // 보충 후보: 출고분 또는 안전재고 미달
      conds.push(
        sql`(COALESCE(${sold.qty}, 0) > 0 OR (COALESCE(${inventory.quantityOnHand},0) - COALESCE(${inventory.quantityReserved},0)) < COALESCE(${inventory.safetyStock},0))`,
      );
      // 발주완료(ordered) 발주에 이미 포함된 도수 제외 (JINY: 다음 출고분 리스트에서 구분)
      conds.push(sql`NOT ${orderedExpr}`);
    } else {
      // 제품검색 추가 (JINY) — 표준 검색(검색어 + 브랜드/타입/주기/갯수 칩)으로 임의 제품 추가.
      // ordered 포함 여부는 제외하지 않고 alreadyOrdered 플래그로 구분 표시.
      const sq = url.searchParams.get('q')?.trim();
      const brandList = (url.searchParams.get('brand') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      const typeList = (url.searchParams.get('type') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      const cycleList = (url.searchParams.get('cycle') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      const packList = (url.searchParams.get('pack') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map(Number)
        .filter((n) => Number.isFinite(n));
      if (!sq && !brandList.length && !typeList.length && !cycleList.length && !packList.length) {
        return NextResponse.json({ candidates: [], supplierScoped: false });
      }
      if (sq) {
        const pat = `%${sq}%`;
        const search = sql`(${lenses.name} ILIKE ${pat} OR ${lenses.brand} ILIKE ${pat} OR ${lensVariants.sku} ILIKE ${pat})`;
        conds.push(search);
      }
      if (brandList.length > 0) conds.push(inArray(lenses.brand, brandList));
      if (typeList.length > 0) conds.push(inArray(lenses.lensType, typeList as never));
      if (cycleList.length > 0) conds.push(inArray(lenses.replacementCycle, cycleList as never));
      if (packList.length > 0) conds.push(inArray(lenses.piecesPerBox, packList));
    }

    // 매입처 선택 시: 그 매입처로 입고했던 제품(lens) 한정 — 이력 없으면 빈 결과 + 플래그
    let supplierScoped = false;
    if (supplierId) {
      const hist = await withDbRetry(() =>
        db.execute(sql`
          SELECT DISTINCT v.lens_id AS lens_id
          FROM inbound_shipments s
          JOIN inventory_lots l ON l.shipment_id = s.id
          JOIN lens_variants v ON v.id = l.variant_id
          WHERE s.supplier_id = ${supplierId}
        `),
      );
      const lensIds = (hist as unknown as { lens_id: string }[]).map((r) => r.lens_id);
      if (lensIds.length > 0) {
        supplierScoped = true;
        conds.push(inArray(lenses.id, lensIds));
      }
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
          standardCost: sql<number>`COALESCE(${lenses.cost}, 0)`,
          onHand: sql<number>`COALESCE(${inventory.quantityOnHand}, 0)`,
          reserved: sql<number>`COALESCE(${inventory.quantityReserved}, 0)`,
          safetyStock: sql<number>`COALESCE(${inventory.safetyStock}, 0)`,
          sold30d: sql<number>`COALESCE(${sold.qty}, 0)`,
          alreadyOrdered: orderedExpr,
        })
        .from(lensVariants)
        .innerJoin(lenses, eq(lenses.id, lensVariants.lensId))
        .leftJoin(inventory, eq(inventory.variantId, lensVariants.id))
        .leftJoin(sold, eq(sold.variantId, lensVariants.id))
        .where(and(...conds))
        .orderBy(sql`COALESCE(${sold.qty},0) DESC`, lenses.brand, lenses.name, lensVariants.sphere)
        .limit(1000),
    );

    const out = rows.map((r) => {
      const available = r.onHand - r.reserved;
      const shortfall = Math.max(0, r.safetyStock - available);
      return {
        ...r,
        available,
        reasonSold: r.sold30d > 0,
        reasonLow: shortfall > 0,
        // 제안 수량: 출고분 재보충과 안전재고 미달분 중 큰 쪽
        suggested: Math.max(r.sold30d, shortfall, 1),
      };
    });

    return NextResponse.json({ candidates: out, supplierScoped });
  }

  return NextResponse.json({ error: 'INVALID_QUERY' }, { status: 400 });
}

const createSchema = z.object({
  supplierId: z.string().uuid(),
  note: z.string().optional(),
  items: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        quantity: z.number().int().positive(),
        unitCost: z.number().int().min(0).default(0),
      }),
    )
    .min(1),
});

/** 발주리스트 생성 → 즉시 '발주완료(ordered)' 상태 */
export async function POST(req: Request) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT', detail: parsed.error.flatten() }, { status: 400 });
  }

  // 도수 스냅샷 조회
  const variantIds = parsed.data.items.map((i) => i.variantId);
  const variants = await withDbRetry(() =>
    db
      .select({
        variantId: lensVariants.id,
        sku: lensVariants.sku,
        sphere: lensVariants.sphere,
        cylinder: lensVariants.cylinder,
        axis: lensVariants.axis,
        addPower: lensVariants.addPower,
        brand: lenses.brand,
        lensName: lenses.name,
      })
      .from(lensVariants)
      .innerJoin(lenses, eq(lenses.id, lensVariants.lensId))
      .where(inArray(lensVariants.id, variantIds)),
  );
  const vmap = new Map(variants.map((v) => [v.variantId, v]));
  for (const it of parsed.data.items) {
    if (!vmap.has(it.variantId)) {
      return NextResponse.json({ error: 'VARIANT_NOT_FOUND', variantId: it.variantId }, { status: 400 });
    }
  }

  const totalCost = parsed.data.items.reduce((s, i) => s + i.quantity * i.unitCost, 0);

  const order = await db.transaction(async (tx) => {
    // 발주번호 PO-YYYYMMDD-NNN — UNIQUE 인덱스 + 당일 건수 기반 (충돌 시 재시도 1회)
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    for (let attempt = 0; ; attempt++) {
      const [{ c }] = (await tx.execute(
        sql`SELECT COUNT(*)::int AS c FROM supplier_orders WHERE order_number LIKE ${'PO-' + today + '-%'}`,
      )) as unknown as { c: number }[];
      const orderNumber = `PO-${today}-${String(c + 1 + attempt).padStart(3, '0')}`;
      try {
        const [created] = await tx
          .insert(supplierOrders)
          .values({
            orderNumber,
            supplierId: parsed.data.supplierId,
            status: 'ordered',
            totalCost,
            note: parsed.data.note,
            createdBy: me.id,
          })
          .returning({ id: supplierOrders.id, orderNumber: supplierOrders.orderNumber });

        await tx.insert(supplierOrderItems).values(
          parsed.data.items.map((it) => {
            const v = vmap.get(it.variantId)!;
            return {
              orderId: created.id,
              variantId: it.variantId,
              brand: v.brand,
              productName: v.lensName,
              sku: v.sku,
              sphere: v.sphere,
              cylinder: v.cylinder,
              axis: v.axis,
              addPower: v.addPower,
              quantity: it.quantity,
              unitCost: it.unitCost,
            };
          }),
        );
        return created;
      } catch (e) {
        if (attempt < 2 && e instanceof Error && /unique/i.test(e.message)) continue;
        throw e;
      }
    }
  });

  return NextResponse.json({ ok: true, orderId: order.id, orderNumber: order.orderNumber });
}
