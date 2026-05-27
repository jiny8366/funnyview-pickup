import { NextResponse } from 'next/server';
import { desc, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { lenses } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { createPriceEntryAndSyncCache } from '@/lib/lens-pricing-entries';
import { validatePricing } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return null;
  return user;
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const rows = await db
    .select()
    .from(lenses)
    .where(isNull(lenses.deletedAt))
    .orderBy(desc(lenses.createdAt));

  return NextResponse.json({ lenses: rows });
}

export async function POST(req: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const {
    productCode,
    brand,
    name,
    lensType,
    replacementCycle,
    piecesPerBox,
    price,
    cost,
    standardCost,
    purchaseDiscountAmount,
    purchaseDiscountPercent,
    standardSupplyPrice,
    supplyDiscountAmount,
    supplyDiscountPercent,
    recommendedRetailPrice,
    purchaseStartsAt,
    purchaseEndsAt,
    supplyStartsAt,
    supplyEndsAt,
    retailStartsAt,
    retailEndsAt,
    imageUrl,
    description,
    baseCurve,
    diameter,
    waterContent,
    material,
    oxygenDkt,
    uvProtection,
    sphereMin,
    sphereMax,
    mfdsPermitNo,
    mfdsClassificationCode,
    mfdsProductName,
    manufacturer,
    colorName,
    colorHex,
    colorPreviewUrl,
    seriesCode,
    isNew,
  } = body ?? {};

  if (!productCode || !brand || !name || !lensType || !replacementCycle || price == null) {
    return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 });
  }

  // 서버 측 가격 검증 (클라이언트와 동일 규칙)
  const issues = validatePricing({
    standardCost: standardCost ?? null,
    purchaseDiscountAmount: purchaseDiscountAmount ?? 0,
    purchaseDiscountPercent: purchaseDiscountPercent ?? 0,
    standardSupplyPrice: standardSupplyPrice ?? null,
    supplyDiscountAmount: supplyDiscountAmount ?? 0,
    supplyDiscountPercent: supplyDiscountPercent ?? 0,
    recommendedRetailPrice: recommendedRetailPrice ?? null,
  });
  const errs = issues.filter((i) => i.severity === 'error');
  if (errs.length > 0) {
    return NextResponse.json(
      { error: 'PRICING_INVALID', detail: errs },
      { status: 400 },
    );
  }

  const [row] = await db
    .insert(lenses)
    .values({
      productCode,
      brand,
      name,
      lensType,
      replacementCycle,
      piecesPerBox: piecesPerBox ?? 1,
      price: Number(price),
      cost: cost == null ? null : Number(cost),
      // standardCost/standardSupplyPrice/recommendedRetailPrice/discount* 은
      // createPriceEntryAndSyncCache 에서 처리 — 시작일 ≤ now 일 때만 캐시 갱신
      imageUrl: imageUrl || null,
      description: description ?? null,
      baseCurve: baseCurve != null && baseCurve !== '' ? String(baseCurve) : null,
      diameter: diameter != null && diameter !== '' ? String(diameter) : null,
      waterContent: waterContent != null && waterContent !== '' ? String(waterContent) : null,
      material: material ?? null,
      oxygenDkt: oxygenDkt != null && oxygenDkt !== '' ? Number(oxygenDkt) : null,
      uvProtection: Boolean(uvProtection),
      sphereMin: sphereMin != null && sphereMin !== '' ? String(sphereMin) : null,
      sphereMax: sphereMax != null && sphereMax !== '' ? String(sphereMax) : null,
      mfdsPermitNo: mfdsPermitNo || null,
      mfdsClassificationCode: mfdsClassificationCode || null,
      mfdsProductName: mfdsProductName || null,
      manufacturer: manufacturer || null,
      colorName: colorName || null,
      colorHex: colorHex || null,
      colorPreviewUrl: colorPreviewUrl || null,
      seriesCode: seriesCode || null,
      isNew: !!isNew,
    })
    .returning();

  // 가격 entry 생성 (각 영역마다, 캐시는 위에서 직접 insert 했지만 entries 시계열 기록)
  if (standardCost != null) {
    await createPriceEntryAndSyncCache(row.id, {
      scope: 'purchase',
      standard: Number(standardCost),
      discountAmount: purchaseDiscountAmount ?? 0,
      discountPercent: purchaseDiscountPercent ?? 0,
      startsAt: purchaseStartsAt ?? null,
      endsAt: purchaseEndsAt ?? null,
      createdBy: user.id,
    });
  }
  if (standardSupplyPrice != null) {
    await createPriceEntryAndSyncCache(row.id, {
      scope: 'supply',
      standard: Number(standardSupplyPrice),
      discountAmount: supplyDiscountAmount ?? 0,
      discountPercent: supplyDiscountPercent ?? 0,
      startsAt: supplyStartsAt ?? null,
      endsAt: supplyEndsAt ?? null,
      createdBy: user.id,
    });
  }
  if (recommendedRetailPrice != null) {
    await createPriceEntryAndSyncCache(row.id, {
      scope: 'retail',
      standard: Number(recommendedRetailPrice),
      startsAt: retailStartsAt ?? null,
      endsAt: retailEndsAt ?? null,
      createdBy: user.id,
    });
  }

  return NextResponse.json({ lens: row });
}
