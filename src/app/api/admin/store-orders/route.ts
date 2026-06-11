import { NextResponse } from 'next/server';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { storeOrderItems, storeOrders, stores } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { InventoryError } from '@/lib/inventory-fifo';
import { shipStoreOrder, StoreOrderShipError } from '@/lib/orders/store-order-ship';

export const dynamic = 'force-dynamic';

const STATUSES = ['placed', 'confirmed', 'shipped', 'received', 'cancelled'] as const;
type StoreOrderStatus = (typeof STATUSES)[number];

function isAdmin(user: { role: string; isMaster: boolean; permissions: string[] }) {
  return (
    user.role === 'admin' ||
    user.isMaster ||
    user.permissions.includes('orders_read') ||
    user.permissions.includes('stores_read')
  );
}

/**
 * GET /api/admin/store-orders — 모든 가맹점 발주 목록 (본사 inbox). admin 전용.
 *   ?status= 로 필터(선택).
 */
export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!me || !isAdmin(me)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const statusParam = new URL(req.url).searchParams.get('status');
  const where = statusParam
    ? eq(storeOrders.status, statusParam)
    : undefined;

  const rows = await db
    .select({
      id: storeOrders.id,
      orderNumber: storeOrders.orderNumber,
      status: storeOrders.status,
      totalSupplyAmount: storeOrders.totalSupplyAmount,
      note: storeOrders.note,
      createdAt: storeOrders.createdAt,
      updatedAt: storeOrders.updatedAt,
      storeId: storeOrders.storeId,
      storeName: stores.name,
      storeCode: stores.code,
      itemCount: sql<number>`(SELECT COUNT(*) FROM ${storeOrderItems} WHERE ${storeOrderItems.orderId} = ${storeOrders.id})::int`,
    })
    .from(storeOrders)
    .leftJoin(stores, eq(stores.id, storeOrders.storeId))
    .where(where)
    .orderBy(desc(storeOrders.createdAt));

  return NextResponse.json({ orders: rows });
}

/** 허용되는 상태 전이. */
const TRANSITIONS: Record<StoreOrderStatus, StoreOrderStatus[]> = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['received', 'cancelled'],
  received: [],
  cancelled: [],
};

/**
 * PATCH /api/admin/store-orders — 상태 전이. admin 전용.
 *   body: { id, status }
 */
export async function PATCH(req: Request) {
  const me = await getCurrentUser();
  if (!me || !isAdmin(me)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    status?: string;
  };
  const id = typeof body.id === 'string' ? body.id : '';
  const next = body.status as StoreOrderStatus | undefined;
  if (!id || !next || !STATUSES.includes(next)) {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }

  const [current] = await db
    .select({ status: storeOrders.status })
    .from(storeOrders)
    .where(eq(storeOrders.id, id))
    .limit(1);
  if (!current) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const allowed = TRANSITIONS[current.status as StoreOrderStatus] ?? [];
  if (!allowed.includes(next)) {
    return NextResponse.json(
      { error: 'INVALID_TRANSITION', from: current.status, to: next },
      { status: 409 },
    );
  }

  // 배송 처리: FIFO 재고 차감 포함 원자 전이 (M3 — warehouse/store-orders 와 동일 헬퍼)
  if (next === 'shipped') {
    try {
      const r = await shipStoreOrder(id);
      return NextResponse.json({ ok: true, ...r });
    } catch (e) {
      if (e instanceof InventoryError) {
        return NextResponse.json(
          { error: e.code, message: e.message, detail: e.detail },
          { status: 409 },
        );
      }
      if (e instanceof StoreOrderShipError) {
        return NextResponse.json({ error: e.code, message: e.message }, { status: 409 });
      }
      throw e;
    }
  }

  const [updated] = await db
    .update(storeOrders)
    .set({ status: next, updatedAt: new Date() })
    .where(eq(storeOrders.id, id))
    .returning();

  return NextResponse.json({ ok: true, order: updated });
}
