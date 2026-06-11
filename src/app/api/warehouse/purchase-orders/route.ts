import { NextResponse } from 'next/server';
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { supplierOrderItems, supplierOrders, suppliers } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { withDbRetry } from '@/lib/db/retry';

export const dynamic = 'force-dynamic';

function allowed(user: { role: string } | null) {
  return user && (user.role === 'warehouse_staff' || user.role === 'admin');
}

/**
 * 픽업서비스(staff) 입고용 — 매입처 발주완료(ordered) 리스트 + 품목.
 * 입고 화면에서 발주서를 불러와 선택·입고처리하는 용도 (JINY).
 */
export async function GET() {
  const me = await getCurrentUser();
  if (!allowed(me)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const orders = await withDbRetry(() =>
    db
      .select({
        id: supplierOrders.id,
        orderNumber: supplierOrders.orderNumber,
        createdAt: supplierOrders.createdAt,
        note: supplierOrders.note,
        supplierId: supplierOrders.supplierId,
        supplierName: suppliers.name,
      })
      .from(supplierOrders)
      .leftJoin(suppliers, eq(suppliers.id, supplierOrders.supplierId))
      .where(eq(supplierOrders.status, 'ordered'))
      .orderBy(desc(supplierOrders.createdAt)),
  );
  if (orders.length === 0) return NextResponse.json({ orders: [] });

  const items = await withDbRetry(() =>
    db
      .select()
      .from(supplierOrderItems)
      .where(inArray(supplierOrderItems.orderId, orders.map((o) => o.id)))
      .orderBy(asc(supplierOrderItems.brand), asc(supplierOrderItems.productName), asc(supplierOrderItems.sphere)),
  );
  const byOrder = new Map<string, typeof items>();
  for (const it of items) {
    const arr = byOrder.get(it.orderId) ?? [];
    arr.push(it);
    byOrder.set(it.orderId, arr);
  }

  return NextResponse.json({
    orders: orders.map((o) => ({ ...o, items: byOrder.get(o.id) ?? [] })),
  });
}

/** 입고 완료 마킹 — body: { id } (ordered → received) */
export async function PATCH(req: Request) {
  const me = await getCurrentUser();
  if (!allowed(me)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });

  const [cur] = await withDbRetry(() =>
    db.select({ status: supplierOrders.status }).from(supplierOrders).where(eq(supplierOrders.id, body.id!)).limit(1),
  );
  if (!cur) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  if (cur.status !== 'ordered') {
    return NextResponse.json({ error: 'INVALID_TRANSITION', from: cur.status }, { status: 409 });
  }

  await db
    .update(supplierOrders)
    .set({ status: 'received', receivedAt: new Date(), updatedAt: new Date() })
    .where(eq(supplierOrders.id, body.id));

  return NextResponse.json({ ok: true });
}
