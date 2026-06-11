import { NextResponse } from 'next/server';
import { desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { storeOrderItems, storeOrders, stores } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { withDbRetry } from '@/lib/db/retry';

export const dynamic = 'force-dynamic';

const STATUSES = ['placed', 'confirmed', 'shipped', 'received', 'cancelled'] as const;
type StoreOrderStatus = (typeof STATUSES)[number];

// 본사 처리 대기분 — 주문 처리 화면 기본 노출 (JINY: 가맹점 발주도 주문 처리에 포함)
const ACTIVE: StoreOrderStatus[] = ['placed', 'confirmed'];

/**
 * 픽업서비스(staff)용 가맹점 B2B 발주 목록.
 * 고객 픽업주문(orders)과 별개 — 화면에서 고객명 대신 '발주'로 표기.
 * 데이터·전이 규칙은 /api/admin/store-orders (W1) 와 동일.
 */
export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!me || (me.role !== 'warehouse_staff' && me.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const statusParam = new URL(req.url).searchParams.get('status');
  const statuses = statusParam
    ? (statusParam.split(',').filter(Boolean) as StoreOrderStatus[])
    : ACTIVE;

  const rows = await withDbRetry(() =>
    db
      .select({
        id: storeOrders.id,
        orderNumber: storeOrders.orderNumber,
        status: storeOrders.status,
        totalSupplyAmount: storeOrders.totalSupplyAmount,
        note: storeOrders.note,
        createdAt: storeOrders.createdAt,
        storeId: storeOrders.storeId,
        storeName: stores.name,
        itemCount: sql<number>`(SELECT COALESCE(SUM(${storeOrderItems.quantity}), 0) FROM ${storeOrderItems} WHERE ${storeOrderItems.orderId} = ${storeOrders.id})::int`,
      })
      .from(storeOrders)
      .leftJoin(stores, eq(stores.id, storeOrders.storeId))
      .where(inArray(storeOrders.status, statuses))
      .orderBy(desc(storeOrders.createdAt)),
  );

  return NextResponse.json({ orders: rows });
}

// 전이 규칙 — admin/store-orders 와 동일 유지 (변경 시 양쪽 함께)
const TRANSITIONS: Record<StoreOrderStatus, StoreOrderStatus[]> = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['received', 'cancelled'],
  received: [],
  cancelled: [],
};

/** PATCH — 발주 상태 전이 (확인/배송). body: { id, status } */
export async function PATCH(req: Request) {
  const me = await getCurrentUser();
  if (!me || (me.role !== 'warehouse_staff' && me.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { id?: string; status?: string };
  const id = typeof body.id === 'string' ? body.id : '';
  const next = body.status as StoreOrderStatus | undefined;
  if (!id || !next || !STATUSES.includes(next)) {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }

  const [current] = await withDbRetry(() =>
    db.select({ status: storeOrders.status }).from(storeOrders).where(eq(storeOrders.id, id)).limit(1),
  );
  if (!current) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  const allowed = TRANSITIONS[current.status as StoreOrderStatus] ?? [];
  if (!allowed.includes(next)) {
    return NextResponse.json(
      { error: 'INVALID_TRANSITION', from: current.status, to: next },
      { status: 409 },
    );
  }

  const [updated] = await db
    .update(storeOrders)
    .set({ status: next, updatedAt: new Date() })
    .where(eq(storeOrders.id, id))
    .returning();

  return NextResponse.json({ ok: true, order: updated });
}
