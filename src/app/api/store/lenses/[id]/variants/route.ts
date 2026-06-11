import { NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { inventory, lensVariants, lenses } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { withDbRetry } from '@/lib/db/retry';

export const dynamic = 'force-dynamic';

/**
 * 가맹점 재주문용 — 렌즈 한 제품의 활성 도수(variant) 목록 + 가용재고.
 * (store 포털은 /api/store 만 allowlist — /api/products 차단되므로 별도 제공)
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'store_staff' || !me.storeId) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const rows = await withDbRetry(() =>
    db
      .select({
        variantId: lensVariants.id,
        sku: lensVariants.sku,
        sphere: lensVariants.sphere,
        cylinder: lensVariants.cylinder,
        axis: lensVariants.axis,
        addPower: lensVariants.addPower,
        price: sql<number>`COALESCE(${lensVariants.priceOverride}, ${lenses.price})`,
        available: sql<number>`COALESCE(${inventory.quantityOnHand} - ${inventory.quantityReserved}, 0)`,
      })
      .from(lensVariants)
      .innerJoin(lenses, eq(lenses.id, lensVariants.lensId))
      .leftJoin(inventory, eq(inventory.variantId, lensVariants.id))
      .where(and(eq(lensVariants.lensId, params.id), eq(lensVariants.isActive, true)))
      .orderBy(lensVariants.sphere, lensVariants.cylinder),
  );

  return NextResponse.json({ variants: rows });
}
