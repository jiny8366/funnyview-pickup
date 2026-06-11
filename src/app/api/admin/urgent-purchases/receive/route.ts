import { NextResponse } from 'next/server';
import { desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import {
  inboundShipments,
  inventoryLots,
  lensVariants,
  urgentPurchases,
} from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { createInboundShipment } from '@/lib/inventory-fifo';
import { withDbRetry } from '@/lib/db/retry';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        quantity: z.number().int().positive().optional(),
        unitCostIncVat: z.number().int().nonnegative().optional(),
      }),
    )
    .min(1),
});

/**
 * POST /api/admin/urgent-purchases/receive — 입고처리(현재고 반영) → 입고완료.
 * body { items: [{ id, quantity?, unitCostIncVat? }] }
 *  - 각 id 는 status='ordered' 여야 함.
 *  - quantity 기본 = quantityShort, unitCost 기본 = 해당 도수 최신 로트 단가(없으면 0).
 *  - 한 트랜잭션에서 lensId 별로 createInboundShipment 호출(재고 반영) 후
 *    urgent 행 status='received', resolvedAt=now.
 */
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }
  const overrides = new Map(parsed.data.items.map((it) => [it.id, it]));
  const ids = [...overrides.keys()];

  // 대상 행 + 도수/제품/매입처 정보
  const rows = await withDbRetry(() =>
    db
      .select({
        id: urgentPurchases.id,
        status: urgentPurchases.status,
        quantityShort: urgentPurchases.quantityShort,
        variantId: urgentPurchases.variantId,
        supplierId: urgentPurchases.supplierId,
        lensId: lensVariants.lensId,
      })
      .from(urgentPurchases)
      .innerJoin(lensVariants, eq(lensVariants.id, urgentPurchases.variantId))
      .where(inArray(urgentPurchases.id, ids)),
  );

  if (rows.length !== ids.length) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }
  const notOrdered = rows.filter((r) => r.status !== 'ordered');
  if (notOrdered.length > 0) {
    return NextResponse.json(
      { error: 'NOT_ORDERED', detail: '발주됨 상태가 아닌 항목이 있습니다.', ids: notOrdered.map((r) => r.id) },
      { status: 400 },
    );
  }

  // 도수별 최신 로트 단가 (단가 기본값)
  const variantIds = [...new Set(rows.map((r) => r.variantId))];
  const costMap = new Map<string, number>();
  const lots = await withDbRetry(() =>
    db
      .select({
        variantId: inventoryLots.variantId,
        unitCostIncVat: inventoryLots.unitCostIncVat,
        inboundDate: inboundShipments.inboundDate,
      })
      .from(inventoryLots)
      .innerJoin(inboundShipments, eq(inboundShipments.id, inventoryLots.shipmentId))
      .where(inArray(inventoryLots.variantId, variantIds))
      .orderBy(desc(inboundShipments.inboundDate), desc(inventoryLots.createdAt)),
  );
  for (const l of lots) {
    if (!costMap.has(l.variantId)) costMap.set(l.variantId, l.unitCostIncVat);
  }

  const today = new Date().toISOString().slice(0, 10);

  await withDbRetry(() =>
    db.transaction(async (tx) => {
      // lensId(+supplierId) 별 그룹화 — 1 전표 = 1제품
      const groups = new Map<
        string,
        { lensId: string; supplierId: string | null; items: { variantId: string; quantity: number; unitCostIncVat: number }[] }
      >();
      for (const r of rows) {
        const ov = overrides.get(r.id);
        const quantity = ov?.quantity ?? r.quantityShort;
        const unitCostIncVat = ov?.unitCostIncVat ?? costMap.get(r.variantId) ?? 0;
        const key = `${r.lensId}|${r.supplierId ?? ''}`;
        let g = groups.get(key);
        if (!g) {
          g = { lensId: r.lensId, supplierId: r.supplierId ?? null, items: [] };
          groups.set(key, g);
        }
        g.items.push({ variantId: r.variantId, quantity, unitCostIncVat });
      }

      for (const g of groups.values()) {
        await createInboundShipment(tx, {
          lensId: g.lensId,
          inboundDate: today,
          supplierId: g.supplierId,
          note: '급매입 입고처리',
          createdBy: me.id,
          items: g.items,
          confirm: true,
        });
      }

      await tx
        .update(urgentPurchases)
        .set({ status: 'received', resolvedAt: new Date() })
        .where(inArray(urgentPurchases.id, ids));
    }),
  );

  return NextResponse.json({ ok: true, received: ids.length });
}
