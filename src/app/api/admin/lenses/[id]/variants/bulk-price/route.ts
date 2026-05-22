import { NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { lensVariants } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/lenses/[id]/variants/bulk-price
 *   body: { variantIds: string[], priceOverride: number | null }
 *
 * 지정된 도수 목록의 priceOverride 일괄 설정/초기화.
 * variantIds 가 해당 lensId 소속인지 검증 후 업데이트.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { variantIds, priceOverride } = body as {
    variantIds?: string[];
    priceOverride?: number | null;
  };

  if (!Array.isArray(variantIds) || variantIds.length === 0) {
    return NextResponse.json({ error: 'MISSING_VARIANT_IDS' }, { status: 400 });
  }
  if (priceOverride !== null && (typeof priceOverride !== 'number' || priceOverride < 0)) {
    return NextResponse.json({ error: 'INVALID_PRICE' }, { status: 400 });
  }

  const updated = await db
    .update(lensVariants)
    .set({ priceOverride: priceOverride ?? null, updatedAt: new Date() })
    .where(
      and(
        eq(lensVariants.lensId, params.id),
        inArray(lensVariants.id, variantIds),
      ),
    )
    .returning({ id: lensVariants.id });

  return NextResponse.json({ ok: true, updatedCount: updated.length });
}
