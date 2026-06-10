import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { orderItems } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { withDbRetry } from '@/lib/db/retry';
import { InventoryError } from '@/lib/inventory-fifo';
import {
  TransitionError,
  cancelOrder,
  markAccepted,
  markPicking,
  markShipped,
} from '@/lib/orders/transitions';

export const dynamic = 'force-dynamic';

const schema = z.object({
  action: z.enum(['accept', 'pick', 'ship', 'cancel']),
  reason: z.string().optional(),
  // 패킹 검수(바코드 스캔) 결과 — ship 시 동봉하면 서버가 주문 품목과 재검증.
  // 검수 UI(M1) 배포 후에는 항상 동봉됨. 미동봉 ship 은 과도기 호환으로 허용.
  scanned: z
    .array(z.object({ variantId: z.string().uuid(), count: z.number().int().min(0) }))
    .optional(),
});

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'warehouse_staff' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }

  try {
    // 각 전이는 단일 원자 트랜잭션(markShipped 의 FIFO 차감 포함) — 연결 블립에 한해 재시도 안전.
    // 이미 커밋된 뒤 재시도되면 INVALID_TRANSITION(비전이 오류)으로 즉시 반환된다. (보드 #4)
    switch (parsed.data.action) {
      case 'accept':
        await withDbRetry(() => markAccepted(ctx.params.id, user.id));
        break;
      case 'pick':
        await withDbRetry(() => markPicking(ctx.params.id, user.id));
        break;
      case 'ship': {
        // 패킹 검수 재검증 — 스캔 수량이 주문 품목(variant별 합계)과 정확히 일치해야 출고.
        if (parsed.data.scanned) {
          const items = await withDbRetry(() =>
            db
              .select({ variantId: orderItems.variantId, quantity: orderItems.quantity })
              .from(orderItems)
              .where(eq(orderItems.orderId, ctx.params.id)),
          );
          const need = new Map<string, number>();
          for (const it of items) need.set(it.variantId, (need.get(it.variantId) ?? 0) + it.quantity);
          const got = new Map<string, number>();
          for (const s of parsed.data.scanned) got.set(s.variantId, (got.get(s.variantId) ?? 0) + s.count);

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
        await withDbRetry(() => markShipped(ctx.params.id, user.id));
        break;
      }
      case 'cancel':
        await withDbRetry(() =>
          cancelOrder(ctx.params.id, user.id, parsed.data.reason ?? 'warehouse_cancel'),
        );
        break;
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof TransitionError) {
      return NextResponse.json({ error: e.code, message: e.message }, { status: 400 });
    }
    // FIFO 출고 예외 — 표시 재고는 있어도 입고 로트가 없거나 부족.
    // 운영자에게 원인·해결경로를 명확히 전달 (500 → 409).
    if (e instanceof InventoryError) {
      return NextResponse.json(
        { error: e.code, message: e.message, detail: e.detail },
        { status: 409 },
      );
    }
    throw e;
  }
}
