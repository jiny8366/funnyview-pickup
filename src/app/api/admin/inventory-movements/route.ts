import { NextResponse } from 'next/server';
import { desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { inventoryMovements, lensVariants, lenses } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { withDbRetry } from '@/lib/db/retry';

export const dynamic = 'force-dynamic';

/**
 * 어드민 재고 입출고 내역 — 고객주문(예약/출고)·가맹점발주·입고·조정이 재고에 반영된 기록.
 * 필터: type(콤마 복수), q(제품명/SKU), 최근 N건(limit, 기본 200).
 */
export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const url = new URL(req.url);
  const typeList = (url.searchParams.get('type') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const q = url.searchParams.get('q')?.trim();
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 200) || 200, 500);

  const rows = await withDbRetry(() =>
    db
      .select({
        id: inventoryMovements.id,
        movementType: inventoryMovements.movementType,
        quantity: inventoryMovements.quantity,
        referenceType: inventoryMovements.referenceType,
        referenceId: inventoryMovements.referenceId,
        note: inventoryMovements.note,
        performedAt: inventoryMovements.performedAt,
        sku: lensVariants.sku,
        brand: lenses.brand,
        lensName: lenses.name,
        sphere: lensVariants.sphere,
        cylinder: lensVariants.cylinder,
        axis: lensVariants.axis,
      })
      .from(inventoryMovements)
      .innerJoin(lensVariants, eq(lensVariants.id, inventoryMovements.variantId))
      .innerJoin(lenses, eq(lenses.id, lensVariants.lensId))
      .where(sql.join(
        [
          // 제품 마스터(GET /api/admin/lenses)와 동일하게 소프트삭제 제품 제외 —
          // 삭제된 제품(예: OLENS)의 과거 movements 가 내역에 남던 불일치 수정.
          isNull(lenses.deletedAt),
          typeList.length > 0 ? inArray(inventoryMovements.movementType, typeList as never) : sql`TRUE`,
          q ? sql`(${lenses.name} ILIKE ${'%' + q + '%'} OR ${lensVariants.sku} ILIKE ${'%' + q + '%'})` : sql`TRUE`,
        ],
        sql` AND `,
      ))
      .orderBy(desc(inventoryMovements.performedAt))
      .limit(limit),
  );

  return NextResponse.json({ movements: rows });
}
