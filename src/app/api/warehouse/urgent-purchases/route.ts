import { NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { urgentPurchases } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { withDbRetry } from '@/lib/db/retry';

export const dynamic = 'force-dynamic';

const schema = z.object({
  orderId: z.string().uuid(),
  items: z
    .array(z.object({ variantId: z.string().uuid(), quantityShort: z.number().int().min(1) }))
    .min(1),
  note: z.string().optional(),
});

/**
 * 패킹 검수 중 수량 부족 → 급매입 리스트 등록 (JINY 확정 플로우).
 * 주문은 picking(처리 중) 유지 — 입고 후 재검수·배송처리.
 * 같은 주문×도수의 미해결(requested/ordered) 건이 있으면 중복 등록하지 않음(멱등).
 */
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me || (me.role !== 'warehouse_staff' && me.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }
  const { orderId, items, note } = parsed.data;

  const existing = await withDbRetry(() =>
    db
      .select({ variantId: urgentPurchases.variantId })
      .from(urgentPurchases)
      .where(
        and(
          eq(urgentPurchases.orderId, orderId),
          inArray(urgentPurchases.status, ['requested', 'ordered']),
          inArray(urgentPurchases.variantId, items.map((i) => i.variantId)),
        ),
      ),
  );
  const skip = new Set(existing.map((e) => e.variantId));
  const fresh = items.filter((i) => !skip.has(i.variantId));

  if (fresh.length > 0) {
    await withDbRetry(() =>
      db.insert(urgentPurchases).values(
        fresh.map((i) => ({
          orderId,
          variantId: i.variantId,
          quantityShort: i.quantityShort,
          note: note ?? null,
          createdBy: me.id,
        })),
      ),
    );
  }

  return NextResponse.json({ ok: true, registered: fresh.length, skippedDuplicates: skip.size });
}
