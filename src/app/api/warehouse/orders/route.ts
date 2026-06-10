import { NextResponse } from 'next/server';
import { and, desc, eq, gte, ilike, inArray, lte, or, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { customers, orderItems, orders, stores } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { withDbRetry } from '@/lib/db/retry';
import type { OrderStatus } from '@/types/order';

export const dynamic = 'force-dynamic';

// 신규(pending=매장결제 미접수, paid=온라인 선결제) + 처리중(accepted/picking)
const ACTIVE_STATUSES: OrderStatus[] = ['pending', 'paid', 'accepted', 'picking'];

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'warehouse_staff' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const url = new URL(req.url);
  const statusParam = url.searchParams.get('status');
  const statuses: OrderStatus[] = statusParam
    ? (statusParam.split(',').filter(Boolean) as OrderStatus[])
    : ACTIVE_STATUSES;

  // 검색 조건 (출고 관리: 날짜 범위 + 주문번호/고객명/가맹점명 검색)
  const q = url.searchParams.get('q')?.trim();
  const from = url.searchParams.get('from'); // YYYY-MM-DD
  const to = url.searchParams.get('to');

  const conds = [inArray(orders.status, statuses)];
  if (from) conds.push(gte(orders.createdAt, new Date(`${from}T00:00:00+09:00`)));
  if (to) conds.push(lte(orders.createdAt, new Date(`${to}T23:59:59+09:00`)));
  if (q) {
    const pat = `%${q}%`;
    const search = or(
      ilike(orders.orderNumber, pat),
      ilike(customers.name, pat),
      ilike(stores.name, pat),
    );
    if (search) conds.push(search);
  }

  const rows = await withDbRetry(() =>
    db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        total: orders.total,
        isPaid: orders.isPaid,
        createdAt: orders.createdAt,
        paidAt: orders.paidAt,
        acceptedAt: orders.acceptedAt,
        pickingAt: orders.pickingAt,
        shippedAt: orders.shippedAt,
        completedAt: orders.completedAt,
        customerName: customers.name,
        customerPhone: customers.phone,
        storeId: orders.pickupStoreId,
        storeName: stores.name,
        storePhone: stores.phone,
        itemCount: sql<number>`(SELECT COUNT(*) FROM ${orderItems} WHERE ${orderItems.orderId} = ${orders.id})`,
      })
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .innerJoin(stores, eq(stores.id, orders.pickupStoreId))
      .where(and(...conds))
      .orderBy(desc(orders.createdAt)),
  );

  return NextResponse.json({ orders: rows });
}
