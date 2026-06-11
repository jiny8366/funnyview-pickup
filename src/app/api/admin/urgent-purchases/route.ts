import { NextResponse } from 'next/server';
import { desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { lensVariants, lenses, orders, suppliers, urgentPurchases } from '@/db/schema';
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
        supplierId: urgentPurchases.supplierId,
        supplierName: suppliers.name,
      })
      .from(urgentPurchases)
      .innerJoin(orders, eq(orders.id, urgentPurchases.orderId))
      .innerJoin(lensVariants, eq(lensVariants.id, urgentPurchases.variantId))
      .innerJoin(lenses, eq(lenses.id, lensVariants.lensId))
      .leftJoin(suppliers, eq(suppliers.id, urgentPurchases.supplierId))
      .where(inArray(urgentPurchases.status, statuses))
      .orderBy(desc(urgentPurchases.createdAt)),
  );

  return NextResponse.json({ urgentPurchases: rows });
}

const patchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['requested', 'ordered', 'received', 'cancelled']).optional(),
  supplierId: z.string().uuid().nullable().optional(), // 매입처 지정/해제 (W1 토대 9f4ddb1)
});

/** 상태 변경(requested→ordered→received/cancelled) 및/또는 매입처 변경 */
export async function PATCH(req: Request) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }
  const { id, status, supplierId } = parsed.data;
  if (status === undefined && supplierId === undefined) {
    return NextResponse.json({ error: 'NO_CHANGE' }, { status: 400 });
  }

  const set: Record<string, unknown> = {};
  if (status !== undefined) {
    set.status = status;
    set.resolvedAt = status === 'received' || status === 'cancelled' ? new Date() : null;
  }
  if (supplierId !== undefined) set.supplierId = supplierId;

  await withDbRetry(() =>
    db.update(urgentPurchases).set(set).where(eq(urgentPurchases.id, id)),
  );
  return NextResponse.json({ ok: true });
}
