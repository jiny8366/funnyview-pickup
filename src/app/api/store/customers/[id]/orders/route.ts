import { NextResponse } from 'next/server';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { customers, lensVariants, orderItems, orders } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { withDbRetry } from '@/lib/db/retry';

export const dynamic = 'force-dynamic';

/**
 * 가맹점용 고객 상세 — 자기 매장 픽업 주문 이력 + 항목 (반품요청·재주문의 데이터 소스).
 * 반품요청 가능: arrived/ready (배송된 제품, JINY) — 전이는 /api/store/orders/[id]/transition 의 'return'.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'store_staff' || !me.storeId) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const orderRows = await withDbRetry(() =>
    db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        total: orders.total,
        isPaid: orders.isPaid,
        createdAt: orders.createdAt,
        orderedByStoreId: orders.orderedByStoreId,
      })
      .from(orders)
      .where(and(eq(orders.customerId, params.id), eq(orders.pickupStoreId, me.storeId!)))
      .orderBy(desc(orders.createdAt))
      .limit(30),
  );
  // 주문이력 없는 고객 = 타 매장 고객 → 접근 차단 (검색 API 와 동일 스코프)
  if (orderRows.length === 0) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const [customer] = await withDbRetry(() =>
    db
      .select({ id: customers.id, name: customers.name, phone: customers.phone })
      .from(customers)
      .where(eq(customers.id, params.id))
      .limit(1),
  );

  const itemRows = await withDbRetry(() =>
    db
      .select({
        orderId: orderItems.orderId,
        variantId: orderItems.variantId,
        lensId: lensVariants.lensId,
        eyeSide: orderItems.eyeSide,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
        lensName: orderItems.lensName,
        lensBrand: orderItems.lensBrand,
        sphere: orderItems.sphere,
        cylinder: orderItems.cylinder,
        axis: orderItems.axis,
        addPower: orderItems.addPower,
        sku: orderItems.skuSnapshot,
      })
      .from(orderItems)
      .leftJoin(lensVariants, eq(lensVariants.id, orderItems.variantId))
      .where(inArray(orderItems.orderId, orderRows.map((o) => o.id))),
  );

  const itemsByOrder = new Map<string, typeof itemRows>();
  for (const it of itemRows) {
    const list = itemsByOrder.get(it.orderId) ?? [];
    list.push(it);
    itemsByOrder.set(it.orderId, list);
  }

  return NextResponse.json({
    customer: customer ?? null,
    orders: orderRows.map((o) => ({
      ...o,
      returnable: o.status === 'arrived' || o.status === 'ready',
      items: itemsByOrder.get(o.id) ?? [],
    })),
  });
}
