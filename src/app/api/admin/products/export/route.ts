import { and, asc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { lenses } from '@/db/schema';
import { requirePermissionForApi } from '@/lib/auth/guards';
import { rowsToCsv } from '@/lib/csv';

export const dynamic = 'force-dynamic';

// 다운로드/업로드 공통 컬럼. productCode 는 매칭 키(수정 불가), 그 외는 편집 대상.
const EXPORT_COLUMNS = [
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

// 사용자가 입력 형식을 알기 쉽도록 만든 예시 행. 업로드용이 아니라 참고용.
const SAMPLE_ROW: Record<string, unknown> = {
  productCode: 'SAMPLE-001',
  brand: '예시브랜드',
  name: '샘플 컬러렌즈 30P',
  lensType: 'color',
  replacementCycle: '1day',
  piecesPerBox: 30,
  baseCurve: '8.60',
  diameter: '14.20',
  waterContent: '55.00',
  material: 'etafilcon A',
  oxygenDkt: 26,
  uvProtection: 'TRUE',
  blueLight: 'FALSE',
  sphereMin: '-10.00',
  sphereMax: '0.00',
  price: 25000,
  cost: 7000,
  standardCost: 8000,
  purchaseDiscountAmount: 500,
  purchaseDiscountPercent: 5,
  standardSupplyPrice: 18000,
  supplyDiscountAmount: 1000,
  supplyDiscountPercent: 10,
  recommendedRetailPrice: 30000,
  manufacturer: '예시 제조사',
  mfdsPermitNo: '제조허가 21-1234',
  mfdsClassificationCode: 'A07020',
  mfdsProductName: '시력보정용 컬러소프트콘택트렌즈',
  colorName: '브라운',
  colorHex: '#8B5A2B',
  seriesCode: 'SAMPLE-SERIES',
  isNew: 'TRUE',
  isActive: 'TRUE',
};

export async function GET(req: Request) {
  const me = await requirePermissionForApi('products_read');
  if (!me) return new Response('forbidden', { status: 403 });

  const url = new URL(req.url);
  const sample = url.searchParams.get('sample') === '1';
  const brand = url.searchParams.get('brand')?.trim();

  if (sample) {
    const csv = rowsToCsv(EXPORT_COLUMNS, [SAMPLE_ROW]);
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('products_sample.csv')}`,
      },
    });
  }

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
