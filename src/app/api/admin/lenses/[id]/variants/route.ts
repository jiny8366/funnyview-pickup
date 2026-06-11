import { NextResponse } from 'next/server';
import { asc, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { inventory, lensBarcodes, lensVariants } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return null;
  return user;
}

/**
 * GET /api/admin/lenses/[id]/variants
 * 제품의 도수별 SKU 목록 (바코드 포함).
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const variants = await db
    .select({
      id: lensVariants.id,
      sku: lensVariants.sku,
      sphere: lensVariants.sphere,
      cylinder: lensVariants.cylinder,
      axis: lensVariants.axis,
      addPower: lensVariants.addPower,
      udiDi: lensVariants.udiDi,
      priceOverride: lensVariants.priceOverride,
      isActive: lensVariants.isActive,
      onHand: sql<number>`COALESCE(${inventory.quantityOnHand}, 0)`,
      safetyStock: sql<number>`COALESCE(${inventory.safetyStock}, 0)`,
      barcodes: sql<string>`COALESCE(
        (SELECT json_agg(json_build_object(
          'id', b.id,
          'barcode', b.barcode,
          'barcodeType', b.barcode_type,
          'isPrimary', b.is_primary
        ) ORDER BY b.is_primary DESC, b.created_at)
        FROM lens_barcodes b WHERE b.variant_id = ${lensVariants.id}),
        '[]'::json
      )`,
    })
    .from(lensVariants)
    .leftJoin(inventory, eq(inventory.variantId, lensVariants.id))
    .where(eq(lensVariants.lensId, params.id))
    .orderBy(asc(lensVariants.sphere), asc(lensVariants.cylinder), asc(lensVariants.axis));

  return NextResponse.json({ variants });
}

/**
 * PATCH /api/admin/lenses/[id]/variants
 * body: { variantId, isActive?, priceOverride? }
 */
export async function PATCH(
  req: Request,
  { params: _ }: { params: { id: string } },
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const variantId = typeof body.variantId === 'string' ? body.variantId : '';
  if (!variantId) return NextResponse.json({ error: 'MISSING_VARIANT_ID' }, { status: 400 });

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.isActive === 'boolean') set.isActive = body.isActive;
  if (body.priceOverride === null || typeof body.priceOverride === 'number') {
    set.priceOverride = body.priceOverride;
  }

  const [updated] = await db
    .update(lensVariants)
    .set(set)
    .where(eq(lensVariants.id, variantId))
    .returning();

  return NextResponse.json({ variant: updated });
}

/**
 * POST /api/admin/lenses/[id]/variants
 * body: { variantId, barcode, barcodeType? }
 * 기존 도수에 바코드 추가.
 */
export async function POST(
  req: Request,
  { params: _ }: { params: { id: string } },
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const variantId = typeof body.variantId === 'string' ? body.variantId : '';
  const barcode = typeof body.barcode === 'string' ? body.barcode.trim() : '';
  if (!variantId || !barcode) {
    return NextResponse.json({ error: 'MISSING_PARAMS' }, { status: 400 });
  }

  try {
    const [bc] = await db
      .insert(lensBarcodes)
      .values({
        variantId,
        barcode,
        barcodeType: typeof body.barcodeType === 'string' ? body.barcodeType : null,
        isPrimary: false,
      })
      .onConflictDoNothing()
      .returning();

    if (!bc) {
      return NextResponse.json({ error: 'BARCODE_EXISTS' }, { status: 409 });
    }
    return NextResponse.json({ barcode: bc });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    return NextResponse.json({ error: 'FAILED', detail: msg }, { status: 500 });
  }
}
