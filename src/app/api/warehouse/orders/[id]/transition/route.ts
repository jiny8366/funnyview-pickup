import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/current-user';
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
    switch (parsed.data.action) {
      case 'accept':
        await markAccepted(ctx.params.id, user.id);
        break;
      case 'pick':
        await markPicking(ctx.params.id, user.id);
        break;
      case 'ship':
        await markShipped(ctx.params.id, user.id);
        break;
      case 'cancel':
        await cancelOrder(ctx.params.id, user.id, parsed.data.reason ?? 'warehouse_cancel');
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
