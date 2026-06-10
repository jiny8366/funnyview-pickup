import { NextResponse } from 'next/server';
import { z } from 'zod';
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
      case 'ship':
        await withDbRetry(() => markShipped(ctx.params.id, user.id));
        break;
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
