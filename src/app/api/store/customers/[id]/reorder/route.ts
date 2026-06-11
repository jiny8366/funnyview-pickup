import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { orders } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { withDbRetry } from '@/lib/db/retry';
import { createOrder, OrderCreationError } from '@/lib/orders/create-order';

export const dynamic = 'force-dynamic';

const reorderSchema = z.object({
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
});

/**
 * 가맹점 대리 재주문 — 도수 수정 후 자기 매장 픽업으로 재주문 (JINY: 반품→도수수정→재주문 흐름).
 * pickupStoreId 는 서버에서 me.storeId 로 강제 (타 매장 주문 생성 불가).
 * 매장결제 모델 그대로 pending 진입 → 스탭 패킹→배송→픽업 시 결제완료.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'store_staff' || !me.storeId) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  // 자기 매장 주문(예약) 이력이 있는 고객만 대리 재주문 가능
  const [link] = await withDbRetry(() =>
    db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.customerId, params.id), eq(orders.pickupStoreId, me.storeId!)))
      .limit(1),
  );
  if (!link) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const parsed = reorderSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_INPUT', detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const order = await createOrder({
      customerId: params.id,
      pickupStoreId: me.storeId,
      orderedByStoreId: me.storeId, // 가맹점 발주 — staff 주문처리에서 '발주' 표시 (JINY)
      customerNote: parsed.data.customerNote,
      lines: parsed.data.lines,
    });
    return NextResponse.json({ ok: true, orderId: order.id, orderNumber: order.orderNumber });
  } catch (e) {
    if (e instanceof OrderCreationError) {
      return NextResponse.json(
        { error: e.code, message: e.message, detail: e.detail },
        { status: 400 },
      );
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[POST /api/store/customers/[id]/reorder]', { storeId: me.storeId, msg });
    return NextResponse.json(
      { error: 'ORDER_CREATE_FAILED', message: `주문 생성 중 오류: ${msg}` },
      { status: 500 },
    );
  }
}
