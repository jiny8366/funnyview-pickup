import { NextResponse } from 'next/server';
import { desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { lensVariants, lenses, orders, urgentPurchases } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { withDbRetry } from '@/lib/db/retry';

export const dynamic = 'force-dynamic';

/** 급매입 리스트 조회 — 어드민 관리 화면용. ?status=requested,ordered (기본: 미해결) */
export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const url = new URL(req.url);
  const statusParam = url.searchParams.get('status');
  const statuses = statusParam
    ? statusParam.split(',').filter(Boolean)
    : ['requested', 'ordered'];

  const rows = await withDbRetry(() =>
    db
      .select({
        id: urgentPurchases.id,
        status: urgentPurchases.status,
        quantityShort: urgentPurchases.quantityShort,
        note: urgentPurchases.note,
        createdAt: urgentPurchases.createdAt,
        resolvedAt: urgentPurchases.resolvedAt,
        orderId: urgentPurchases.orderId,
        orderNumber: orders.orderNumber,
        orderStatus: orders.status,
        variantId: urgentPurchases.variantId,
        sku: lensVariants.sku,
        sphere: lensVariants.sphere,
        cylinder: lensVariants.cylinder,
        axis: lensVariants.axis,
        lensName: lenses.name,
        lensBrand: lenses.brand,
      })
      .from(urgentPurchases)
      .innerJoin(orders, eq(orders.id, urgentPurchases.orderId))
      .innerJoin(lensVariants, eq(lensVariants.id, urgentPurchases.variantId))
      .innerJoin(lenses, eq(lenses.id, lensVariants.lensId))
      .where(inArray(urgentPurchases.status, statuses))
      .orderBy(desc(urgentPurchases.createdAt)),
  );

  return NextResponse.json({ urgentPurchases: rows });
}

const patchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['requested', 'ordered', 'received', 'cancelled']),
});

/** 상태 변경: requested(대기)→ordered(발주)→received(입고완료, 재검수 가능)/cancelled */
export async function PATCH(req: Request) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }
  const { id, status } = parsed.data;
  const resolved = status === 'received' || status === 'cancelled';

  await withDbRetry(() =>
    db
      .update(urgentPurchases)
      .set({ status, resolvedAt: resolved ? new Date() : null })
      .where(eq(urgentPurchases.id, id)),
  );
  return NextResponse.json({ ok: true });
}
