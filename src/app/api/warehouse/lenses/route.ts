import { NextResponse } from 'next/server';
import { asc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { inventory, lenses, lensVariants } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

async function requireStaff() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== 'warehouse_staff' && user.role !== 'admin') return null;
  return user;
}

/**
 * GET /api/warehouse/lenses
 *   ?q=검색어  → 브랜드/제품명/제품코드 검색
 *
 * 전표 입고 모드용 — 제품 선택 후 활성 도수 조회.
 */
export async function GET(req: Request) {
  const user = await requireStaff();
  if (!user) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const url = new URL(req.url);
  const q = url.searchParams.get('q') ?? '';

  const where = q
    ? or(
        ilike(lenses.brand, `%${q}%`),
        ilike(lenses.name, `%${q}%`),
        ilike(lenses.productCode, `%${q}%`),
      )
    : isNull(lenses.deletedAt);

  const rows = await db
    .select({
      id: lenses.id,
      brand: lenses.brand,
      name: lenses.name,
      productCode: lenses.productCode,
      lensType: lenses.lensType,
      replacementCycle: lenses.replacementCycle,
      piecesPerBox: lenses.piecesPerBox,
    })
    .from(lenses)
    .where(q ? sql`(${where}) AND ${isNull(lenses.deletedAt)}` : where)
    .orderBy(asc(lenses.brand), asc(lenses.name))
    .limit(100);

  return NextResponse.json({ lenses: rows });
}

/**
 * GET /api/warehouse/lenses?lensId=... (variants for a lens)
 * 실제로는 별도 경로 /api/warehouse/lenses/[id]/variants 이 더 깔끔하지만
 * 쿼리 파라미터로 처리.
 */
export async function POST(req: Request) {
  const user = await requireStaff();
  if (!user) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const lensId = typeof body.lensId === 'string' ? body.lensId : '';
  if (!lensId) return NextResponse.json({ error: 'MISSING_LENS_ID' }, { status: 400 });

  const variants = await db
    .select({
      id: lensVariants.id,
      sku: lensVariants.sku,
      sphere: lensVariants.sphere,
      cylinder: lensVariants.cylinder,
      axis: lensVariants.axis,
      addPower: lensVariants.addPower,
      isActive: lensVariants.isActive,
      onHand: sql<number>`COALESCE(${inventory.quantityOnHand}, 0)`,
    })
    .from(lensVariants)
    .leftJoin(inventory, eq(inventory.variantId, lensVariants.id))
    .where(eq(lensVariants.lensId, lensId))
    .orderBy(asc(lensVariants.sphere), asc(lensVariants.cylinder), asc(lensVariants.axis));

  return NextResponse.json({ variants });
}
