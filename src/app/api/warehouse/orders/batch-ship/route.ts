import { NextResponse } from 'next/server';
import { inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { orderItems, orders } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { withDbRetry } from '@/lib/db/retry';
import { InventoryError } from '@/lib/inventory-fifo';
import { TransitionError, markShipped } from '@/lib/orders/transitions';

export const dynamic = 'force-dynamic';

const schema = z.object({
  orderIds: z.array(z.string().uuid()).min(1).max(200),
  // 한 박스(가맹점) 단위 스캔 검수 결과 — 묶인 전표 전체 품목 합계와 일치해야 출고.
  scanned: z.array(z.object({ variantId: z.string().uuid(), count: z.number().int().min(0) })).optional(),
});

/**
 * 가맹점 단위 일괄 출고(배송 확정).
 * 같은 가맹점의 picking 전표 여러 건을 한 박스로 검수했을 때, 스캔 합계가 전표 전체
 * 품목 합계와 정확히 일치하면 각 전표를 shipped 로 전이(FIFO 차감 + 고객·가맹점 배송중 알림).
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'warehouse_staff' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  const { orderIds, scanned } = parsed.data;

  // 1) 대상 전표 검증 — 모두 존재 + picking + 동일 가맹점(pickupStore)
  const heads = await withDbRetry(() =>
    db
      .select({ id: orders.id, status: orders.status, storeId: orders.pickupStoreId })
      .from(orders)
      .where(inArray(orders.id, orderIds)),
  );
  if (heads.length !== orderIds.length) {
    return NextResponse.json({ error: 'ORDER_NOT_FOUND', message: '일부 전표를 찾을 수 없습니다.' }, { status: 404 });
  }
  const notPicking = heads.filter((h) => h.status !== 'picking');
  if (notPicking.length) {
    return NextResponse.json(
      { error: 'INVALID_TRANSITION', message: '배송준비중(picking) 전표만 출고할 수 있습니다.' },
      { status: 400 },
    );
  }
  const storeIds = new Set(heads.map((h) => h.storeId));
  if (storeIds.size > 1) {
    return NextResponse.json(
      { error: 'MIXED_STORE', message: '서로 다른 가맹점의 전표는 한 박스로 출고할 수 없습니다.' },
      { status: 400 },
    );
  }

  // 2) 스캔 검수 재검증 — 묶인 전표 전체 품목 합계(variant별)와 정확히 일치해야 출고.
  if (scanned) {
    const items = await withDbRetry(() =>
      db
        .select({ variantId: orderItems.variantId, quantity: orderItems.quantity })
        .from(orderItems)
        .where(inArray(orderItems.orderId, orderIds)),
    );
    const need = new Map<string, number>();
    for (const it of items) need.set(it.variantId, (need.get(it.variantId) ?? 0) + it.quantity);
    const got = new Map<string, number>();
    for (const s of scanned) got.set(s.variantId, (got.get(s.variantId) ?? 0) + s.count);

    const mismatches: { variantId: string; required: number; scanned: number }[] = [];
    for (const [vid, req2] of need) {
      const g = got.get(vid) ?? 0;
      if (g !== req2) mismatches.push({ variantId: vid, required: req2, scanned: g });
    }
    for (const [vid, g] of got) {
      if (!need.has(vid) && g > 0) mismatches.push({ variantId: vid, required: 0, scanned: g });
    }
    if (mismatches.length > 0) {
      return NextResponse.json(
        {
          error: 'SCAN_MISMATCH',
          message: '스캔 수량이 주문 품목과 일치하지 않습니다. 패킹을 다시 확인하세요.',
          detail: { mismatches },
        },
        { status: 409 },
      );
    }
  }

  // 3) 전표별 출고(shipped) — FIFO 차감 + 고객·가맹점 배송중 알림. 건별 트랜잭션.
  const shipped: string[] = [];
  try {
    for (const id of orderIds) {
      await withDbRetry(() => markShipped(id, user.id));
      shipped.push(id);
    }
  } catch (e) {
    if (e instanceof TransitionError) {
      return NextResponse.json(
        { error: e.code, message: e.message, detail: { shipped } },
        { status: 400 },
      );
    }
    if (e instanceof InventoryError) {
      return NextResponse.json(
        { error: e.code, message: e.message, detail: { ...e.detail, shipped } },
        { status: 409 },
      );
    }
    throw e;
  }

  return NextResponse.json({ ok: true, shipped: shipped.length });
}
