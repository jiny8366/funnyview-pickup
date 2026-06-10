import { NextResponse } from 'next/server';
import { asc, desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { customers, orderItems, orderStatusHistory, orders, payments, stores } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { withDbRetry } from '@/lib/db/retry';

export const dynamic = 'force-dynamic';

/**
 * 출고 관리 상세 (리스트 클릭 → 내용 보기).
 * 주문 헤더 + 품목 + 상태 이력 + 가맹점 결제 기록(결제완료/노쇼 확인용).
 */
export async function GET(
  _req: Request,
  ctx: { params: { id: string } },
) {
  const me = await getCurrentUser();
  if (!me || (me.role !== 'warehouse_staff' && me.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const orderId = ctx.params.id;

  const head = await withDbRetry(() =>
    db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        subtotal: orders.subtotal,
        discount: orders.discount,
        total: orders.total,
        isPaid: orders.isPaid,
        customerNote: orders.customerNote,
        createdAt: orders.createdAt,
        paidAt: orders.paidAt,
        shippedAt: orders.shippedAt,
        arrivedAt: orders.arrivedAt,
        readyAt: orders.readyAt,
        completedAt: orders.completedAt,
        customerName: customers.name,
        customerPhone: customers.phone,
        storeName: stores.name,
        storePhone: stores.phone,
      })
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .innerJoin(stores, eq(stores.id, orders.pickupStoreId))
      .where(eq(orders.id, orderId))
      .limit(1),
  );
  if (!head[0]) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const [items, history, pays] = await Promise.all([
    withDbRetry(() =>
      db
        .select({
          lensName: orderItems.lensName,
          lensBrand: orderItems.lensBrand,
          sku: orderItems.skuSnapshot,
          eyeSide: orderItems.eyeSide,
          sphere: orderItems.sphere,
          cylinder: orderItems.cylinder,
          axis: orderItems.axis,
          quantity: orderItems.quantity,
          unitPrice: orderItems.unitPrice,
          lineTotal: orderItems.lineTotal,
        })
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId))
        .orderBy(asc(orderItems.eyeSide)),
    ),
    withDbRetry(() =>
      db
        .select({
          fromStatus: orderStatusHistory.fromStatus,
          toStatus: orderStatusHistory.toStatus,
          note: orderStatusHistory.note,
          createdAt: orderStatusHistory.changedAt,
        })
        .from(orderStatusHistory)
        .where(eq(orderStatusHistory.orderId, orderId))
        .orderBy(asc(orderStatusHistory.changedAt)),
    ),
    withDbRetry(() =>
      db
        .select({
          amount: payments.amount,
          method: payments.method,
          venue: payments.venue,
          status: payments.status,
          paidAt: payments.paidAt,
        })
        .from(payments)
        .where(eq(payments.orderId, orderId))
        .orderBy(desc(payments.paidAt)),
    ),
  ]);

  return NextResponse.json({ order: head[0], items, history, payments: pays });
}
