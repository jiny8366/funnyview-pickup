import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  inboundShipments,
  inventory,
  inventoryLots,
  lenses,
  lensBarcodes,
  lensVariants,
} from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { parseBarcode } from '@/lib/barcode/parse';
import { formatLensDisplayName } from '@/lib/lens/format';

export const dynamic = 'force-dynamic';

async function requireStaff() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== 'warehouse_staff' && user.role !== 'admin') return null;
  return user;
}

/**
 * POST /api/warehouse/inbound/lookup
 *   body: { raw: string }   바코드 원본 (스캐너 출력 또는 키보드 입력)
 *   res:  { parsed, match }
 *
 *   - parsed: 파싱 결과 (DI/format/PI)
 *   - match : { variant, lens, displayName, inventory } | null
 */
export async function POST(req: Request) {
  const user = await requireStaff();
  if (!user) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const raw = typeof body.raw === 'string' ? body.raw : '';
  if (!raw) {
    return NextResponse.json({ error: 'EMPTY_BARCODE' }, { status: 400 });
  }

  const parsed = parseBarcode(raw);

  if (!parsed.di) {
    return NextResponse.json({ parsed, match: null });
  }

  // [1] lens_variants.udi_di 직접 조회 + lens_barcodes 백업 조회
  const variantRows = await db
    .select({
      variant: lensVariants,
      lens: lenses,
    })
    .from(lensVariants)
    .innerJoin(lenses, eq(lenses.id, lensVariants.lensId))
    .where(eq(lensVariants.udiDi, parsed.di))
    .limit(1);

  let matched = variantRows[0];

  if (!matched) {
    // 백업: lens_barcodes 테이블 조회 (수기 등록된 매장 내부 코드 포함)
    const barcodeRows = await db
      .select({
        variant: lensVariants,
        lens: lenses,
      })
      .from(lensBarcodes)
      .innerJoin(lensVariants, eq(lensVariants.id, lensBarcodes.variantId))
      .innerJoin(lenses, eq(lenses.id, lensVariants.lensId))
      .where(eq(lensBarcodes.barcode, parsed.di))
      .limit(1);
    matched = barcodeRows[0];
  }

  if (!matched) {
    return NextResponse.json({ parsed, match: null });
  }

  // 재고 조회
  const [invRow] = await db
    .select()
    .from(inventory)
    .where(eq(inventory.variantId, matched.variant.id))
    .limit(1);

  // 최근 입고 로트의 단가 (가장 최근 입고일 기준) — 입고 단가 자동입력용
  const [lastLot] = await db
    .select({ unitCostIncVat: inventoryLots.unitCostIncVat })
    .from(inventoryLots)
    .innerJoin(
      inboundShipments,
      eq(inventoryLots.shipmentId, inboundShipments.id),
    )
    .where(eq(inventoryLots.variantId, matched.variant.id))
    .orderBy(desc(inboundShipments.inboundDate), desc(inventoryLots.createdAt))
    .limit(1);

  return NextResponse.json({
    parsed,
    match: {
      variant: matched.variant,
      lens: matched.lens,
      displayName: formatLensDisplayName(matched.lens, matched.variant),
      inventory: invRow ?? null,
      lastUnitCost: lastLot?.unitCostIncVat ?? 0,
    },
  });
}
