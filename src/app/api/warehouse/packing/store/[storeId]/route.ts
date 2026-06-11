import { NextResponse } from 'next/server';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { customers, orderItems, orders, stores } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { withDbRetry } from '@/lib/db/retry';

export const dynamic = 'force-dynamic';

/**
 * 가맹점 단위 팩킹 검수 데이터.
 * 해당 가맹점(pickupStore)으로 배송 대기(picking) 중인 모든 전표를 한 박스로 묶어
 * 품목을 variant 단위로 집계한다. 픽업한 실물 바코드를 스캔해 이 집계와 대조 → 확정 → 배송.
 * (한 가맹점에 여러 전표가 있어도 함께 검수·동봉·배송)
 */
export async function GET(_req: Request, ctx: { params: { storeId: string } }) {
  const me = await getCurrentUser();
  if (!me || (me.role !== 'warehouse_staff' && me.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const storeId = ctx.params.storeId;

  const store = await withDbRetry(() =>
    db
      .select({
        id: stores.id,
        name: stores.name,
        phone: stores.phone,
        address: stores.addressLine1,
      })
      .from(stores)
      .where(eq(stores.id, storeId))
      .limit(1),
  );
  if (!store[0]) return NextResponse.json({ error: 'STORE_NOT_FOUND' }, { status: 404 });

  const heads = await withDbRetry(() =>
    db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        orderedByStoreId: orders.orderedByStoreId,
        customerName: customers.name,
      })
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .where(and(eq(orders.pickupStoreId, storeId), eq(orders.status, 'picking')))
      .orderBy(asc(orders.orderNumber)),
  );

  const orderIds = heads.map((h) => h.id);
  const items = orderIds.length
    ? await withDbRetry(() =>
        db
          .select({
            orderId: orderItems.orderId,
            variantId: orderItems.variantId,
            sku: orderItems.skuSnapshot,
            lensName: orderItems.lensName,
            lensBrand: orderItems.lensBrand,
            eyeSide: orderItems.eyeSide,
            sphere: orderItems.sphere,
            cylinder: orderItems.cylinder,
            axis: orderItems.axis,
            quantity: orderItems.quantity,
          })
          .from(orderItems)
          .where(inArray(orderItems.orderId, orderIds))
          .orderBy(asc(orderItems.lensBrand), asc(orderItems.sphere)),
      )
    : [];

  // variant 단위 집계 (한 박스에 담아 스캔 대조할 실물 수량)
  const reqMap = new Map<
    string,
    { variantId: string; sku: string; lensName: string; lensBrand: string; sphere: string | null; cylinder: string | null; axis: number | null; quantity: number }
  >();
  for (const it of items) {
    const cur = reqMap.get(it.variantId);
    if (cur) cur.quantity += it.quantity;
    else
      reqMap.set(it.variantId, {
        variantId: it.variantId,
        sku: it.sku,
        lensName: it.lensName,
        lensBrand: it.lensBrand,
        sphere: it.sphere,
        cylinder: it.cylinder,
        axis: it.axis,
        quantity: it.quantity,
      });
  }

  // 전표별 품목 (참고 표시용)
  const byOrder = heads.map((h) => ({
    id: h.id,
    orderNumber: h.orderNumber,
    customerName: h.orderedByStoreId ? '발주' : h.customerName,
    items: items.filter((it) => it.orderId === h.id),
  }));

  return NextResponse.json({
    store: store[0],
    orders: byOrder,
    orderIds,
    required: Array.from(reqMap.values()),
  });
}
