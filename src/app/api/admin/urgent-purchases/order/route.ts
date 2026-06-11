import { NextResponse } from 'next/server';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { urgentPurchases } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { withDbRetry } from '@/lib/db/retry';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  supplierId: z.string().uuid().optional(),
});

/**
 * POST /api/admin/urgent-purchases/order — 발주확정.
 * body { ids: string[], supplierId? }
 *  - supplierId 가 오면 해당 ids 전체에 먼저 매입처를 지정.
 *  - 모든 대상 행이 매입처를 가져야 함(전달값 또는 기존값). 없으면 400.
 *  - status='ordered' 로 일괄 변경.
 */
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }
  const { ids, supplierId } = parsed.data;

  const updated = await withDbRetry(() =>
    db.transaction(async (tx) => {
      // 1. supplierId 가 주어지면 대상 전체에 먼저 지정
      if (supplierId) {
        await tx
          .update(urgentPurchases)
          .set({ supplierId })
          .where(inArray(urgentPurchases.id, ids));
      }

      // 2. 대상 행 재조회 — 매입처 누락 검증 + 상태 확인
      const rows = await tx
        .select({
          id: urgentPurchases.id,
          status: urgentPurchases.status,
          supplierId: urgentPurchases.supplierId,
        })
        .from(urgentPurchases)
        .where(inArray(urgentPurchases.id, ids));

      const missing = rows.filter((r) => !r.supplierId);
      if (missing.length > 0) {
        throw new MissingSupplierError(missing.map((m) => m.id));
      }

      // 3. status='ordered' 일괄 변경 (requested 상태인 것만 발주 전환)
      const target = rows.filter((r) => r.status === 'requested').map((r) => r.id);
      if (target.length > 0) {
        await tx
          .update(urgentPurchases)
          .set({ status: 'ordered' })
          .where(inArray(urgentPurchases.id, target));
      }
      return target.length;
    }),
  ).catch((e) => {
    if (e instanceof MissingSupplierError) return e;
    throw e;
  });

  if (updated instanceof MissingSupplierError) {
    return NextResponse.json(
      { error: 'SUPPLIER_REQUIRED', detail: '매입처가 지정되지 않은 항목이 있습니다.', ids: updated.ids },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, updated });
}

class MissingSupplierError extends Error {
  constructor(public ids: string[]) {
    super('SUPPLIER_REQUIRED');
    this.name = 'MissingSupplierError';
  }
}
