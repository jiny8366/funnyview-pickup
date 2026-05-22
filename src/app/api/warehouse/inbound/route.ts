import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { lensVariants } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { createInboundShipment } from '@/lib/inventory-fifo';

export const dynamic = 'force-dynamic';

async function requireStaff() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== 'warehouse_staff' && user.role !== 'admin') return null;
  return user;
}

/**
 * POST /api/warehouse/inbound
 *   body: {
 *     variantId:        string,
 *     quantity:         number  (팩 수, 양수),
 *     unitCostIncVat:   number  (단위 입고가, 부가세포함 KRW),
 *     inboundDate?:     string  (YYYY-MM-DD, 기본 오늘),
 *     invoiceRef?:      string  (전표번호),
 *     supplierId?:      string,
 *     note?:            string,
 *   }
 *
 *   동작 (FIFO 백엔드 사용):
 *     - inbound_shipments: 1행 INSERT (lensId 자동 도출)
 *     - inventory_lots:    1행 INSERT (quantityRemaining = quantity)
 *     - inventory:         quantity_on_hand += quantity (upsert)
 *     - inventory_movements: 'inbound' 이동 1행 (lot_id, unit_cost_snapshot 포함)
 *
 *   결과: { ok, shipment, lot, inventory, movement }
 */
export async function POST(req: Request) {
  const user = await requireStaff();
  if (!user) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const variantId = typeof body.variantId === 'string' ? body.variantId : '';
  const quantity = Number(body.quantity);
  const unitCostIncVat = Number(body.unitCostIncVat);
  const inboundDate =
    typeof body.inboundDate === 'string' && body.inboundDate
      ? body.inboundDate
      : new Date().toISOString().slice(0, 10);
  const invoiceRef = typeof body.invoiceRef === 'string' ? body.invoiceRef : null;
  const supplierId = typeof body.supplierId === 'string' ? body.supplierId : null;
  const note = typeof body.note === 'string' ? body.note : null;

  if (!variantId || !Number.isInteger(quantity) || quantity <= 0) {
    return NextResponse.json({ error: 'INVALID_PARAMS' }, { status: 400 });
  }
  if (!Number.isFinite(unitCostIncVat) || unitCostIncVat < 0) {
    return NextResponse.json(
      { error: 'INVALID_UNIT_COST', detail: '단가는 0 이상의 숫자여야 합니다' },
      { status: 400 },
    );
  }

  // variant → lensId 도출
  const [variant] = await db
    .select({ id: lensVariants.id, lensId: lensVariants.lensId })
    .from(lensVariants)
    .where(eq(lensVariants.id, variantId))
    .limit(1);
  if (!variant) {
    return NextResponse.json({ error: 'VARIANT_NOT_FOUND' }, { status: 404 });
  }

  try {
    const result = await db.transaction(async (tx) => {
      return await createInboundShipment(tx, {
        lensId: variant.lensId,
        inboundDate,
        supplierId,
        invoiceRef,
        note,
        createdBy: user.id,
        items: [
          {
            variantId,
            quantity,
            unitCostIncVat: Math.round(unitCostIncVat),
          },
        ],
        confirm: true,
      });
    });

    return NextResponse.json({
      ok: true,
      shipment: result.shipment,
      lot: result.lots[0],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    console.error('inbound error:', e);
    return NextResponse.json({ error: 'INBOUND_FAILED', detail: msg }, { status: 500 });
  }
}
