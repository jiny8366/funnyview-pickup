import { NextResponse } from 'next/server';
import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { orderItems, orders, stores } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { createOrder, OrderCreationError } from '@/lib/orders/create-order';
import { ensureCustomerForUser, findCustomerIdForUser } from '@/lib/orders/ensure-customer';
import { markPaid } from '@/lib/orders/transitions';

export const dynamic = 'force-dynamic';

const createOrderSchema = z.object({
  pickupStoreId: z.string().uuid(),
  customerNote: z.string().optional(),
  lines: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        eyeSide: z.enum(['left', 'right', 'both']),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
  // 결제 (Phase 3: mock — 카드/현금 표시만)
  payOnline: z.boolean().optional(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  const parsed = createOrderSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_INPUT', detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  let customerId: string;
  try {
    customerId = user.customerId ?? (await ensureCustomerForUser(user.id));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[POST /api/orders] ensureCustomer failed', { userId: user.id, msg });
    return NextResponse.json(
      { error: 'CUSTOMER_ENSURE_FAILED', message: `고객 정보 보장 실패: ${msg}` },
      { status: 500 },
    );
  }

  try {
    const order = await createOrder({
      customerId,
      pickupStoreId: parsed.data.pickupStoreId,
      customerNote: parsed.data.customerNote,
      lines: parsed.data.lines,
    });

    // 매장결제(현장수령) 모델: 신규 주문은 'pending'(신규·미결제)으로 두고 픽업업체 스탭이
    // 접수→픽리스트→배송 처리, 결제완료는 픽업 시점(가맹점)에서 completed 로 처리한다.
    // 온라인 선결제(payOnline)인 경우에만 결제완료(paid)로 진입.
    if (parsed.data.payOnline) {
      await markPaid(order.id, user.id);
    }

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
    });
  } catch (e) {
    if (e instanceof OrderCreationError) {
      return NextResponse.json(
        { error: e.code, message: e.message, detail: e.detail },
        { status: 400 },
      );
    }
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    console.error('[POST /api/orders] unexpected error', {
      userId: user.id,
      customerId,
      lines: parsed.data.lines,
      msg,
      stack,
    });
    return NextResponse.json(
      { error: 'ORDER_CREATE_FAILED', message: `주문 생성 중 오류: ${msg}` },
      { status: 500 },
    );
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  const customerId = user.customerId ?? (await findCustomerIdForUser(user.id));
  if (!customerId) {
    return NextResponse.json({ orders: [] });
  }

  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      total: orders.total,
      createdAt: orders.createdAt,
      shippedAt: orders.shippedAt,
      readyAt: orders.readyAt,
      completedAt: orders.completedAt,
      storeName: stores.name,
      storePhone: stores.phone,
      itemCount: sql<number>`(SELECT COUNT(*) FROM ${orderItems} WHERE ${orderItems.orderId} = ${orders.id})`,
    })
    .from(orders)
    .innerJoin(stores, eq(stores.id, orders.pickupStoreId))
    .where(eq(orders.customerId, customerId))
    .orderBy(desc(orders.createdAt));

  return NextResponse.json({ orders: rows });
}
