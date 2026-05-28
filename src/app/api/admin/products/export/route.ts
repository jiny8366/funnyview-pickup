import { and, asc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { lenses } from '@/db/schema';
import { requirePermissionForApi } from '@/lib/auth/guards';
import { rowsToCsv } from '@/lib/csv';

export const dynamic = 'force-dynamic';

// 다운로드/업로드 공통 컬럼. productCode 는 매칭 키(수정 불가), 그 외는 편집 대상.
export const EXPORT_COLUMNS = [
  'productCode',
  'brand',
  'name',
  'lensType',
  'replacementCycle',
  'piecesPerBox',
  'baseCurve',
  'diameter',
  'waterContent',
  'material',
  'oxygenDkt',
  'uvProtection',
  'blueLight',
  'sphereMin',
  'sphereMax',
  'price',
  'cost',
  'standardCost',
  'purchaseDiscountAmount',
  'purchaseDiscountPercent',
  'standardSupplyPrice',
  'supplyDiscountAmount',
  'supplyDiscountPercent',
  'recommendedRetailPrice',
  'manufacturer',
  'mfdsPermitNo',
  'mfdsClassificationCode',
  'mfdsProductName',
  'colorName',
  'colorHex',
  'seriesCode',
  'isNew',
  'isActive',
];

export async function GET(req: Request) {
  const me = await requirePermissionForApi('products_read');
  if (!me) return new Response('forbidden', { status: 403 });

  const url = new URL(req.url);
  const brand = url.searchParams.get('brand')?.trim();

  const rows = await db
    .select()
    .from(lenses)
    .where(and(isNull(lenses.deletedAt), brand ? eq(lenses.brand, brand) : undefined))
    .orderBy(asc(lenses.brand), asc(lenses.productCode));

  const csv = rowsToCsv(EXPORT_COLUMNS, rows as unknown as Record<string, unknown>[]);
  const stamp = new Date().toISOString().slice(0, 10);
  const safeBrand = (brand ?? 'all').replace(/[^\w가-힣-]/g, '_');
  const filename = `products_${safeBrand}_${stamp}.csv`;

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
