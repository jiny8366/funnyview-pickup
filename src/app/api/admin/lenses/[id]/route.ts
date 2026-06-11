import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { lenses } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { createPriceEntryAndSyncCache } from '@/lib/lens-pricing-entries';
import { validatePricing } from '@/lib/pricing';
import { numericStr } from '@/lib/utils/numeric';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return null;
  return user;
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const [row] = await db.select().from(lenses).where(eq(lenses.id, params.id)).limit(1);
  if (!row) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ lens: row });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const allowed: Record<string, unknown> = {};
  const fields = [
    'productCode',
    'brand',
    'name',
    'lensType',
    'replacementCycle',
    'piecesPerBox',
    'price',
    'cost',
    // 가격 정적 컬럼 (standardCost/standardSupplyPrice/recommendedRetailPrice/discount*) 은
    // createPriceEntryAndSyncCache 가 처리 — 시작일 ≤ now 일 때만 캐시 갱신
    'imageUrl',
    'videoUrl',
    'description',
    'baseCurve',
    'diameter',
    'waterContent',
    'material',
    'oxygenDkt',
    'uvProtection',
    'blueLight',
    'sphereMin',
    'sphereMax',
    'mfdsPermitNo',
    'mfdsClassificationCode',
    'mfdsProductName',
    'manufacturer',
    'colorName',
    'colorHex',
    'colorPreviewUrl',
    'seriesCode',
    'isNew',
    'isActive',
  ] as const;

  const numericFields = new Set(['price', 'cost', 'piecesPerBox']);

  for (const k of fields) {
    if (k in body) {
      const v = body[k];
      if (numericFields.has(k)) {
        allowed[k] = v == null ? null : Number(v);
      } else if (k === 'oxygenDkt') {
        allowed[k] = v == null || v === '' ? null : Number(v);
      } else if (k === 'videoUrl' || k === 'imageUrl') {
        // 빈 문자열 → NULL (미디어 미설정)
        allowed[k] = v ? v : null;
      } else if (['baseCurve', 'diameter', 'waterContent', 'sphereMin', 'sphereMax'].includes(k)) {
        // numeric 컬럼 — '54%','8.6mm' 등에서 숫자만 추출(잘못된 값으로 인한 500 방지)
        allowed[k] = numericStr(v);
      } else {
        allowed[k] = v;
      }
    }
  }
  allowed.updatedAt = new Date();

  // 가격 검증 (body 에 가격 관련 필드가 하나라도 있으면)
  const hasPricing = [
    'standardCost',
    'purchaseDiscountAmount',
    'purchaseDiscountPercent',
    'standardSupplyPrice',
    'supplyDiscountAmount',
    'supplyDiscountPercent',
    'recommendedRetailPrice',
  ].some((k) => k in body);
  if (hasPricing) {
    const issues = validatePricing({
      standardCost: body.standardCost ?? null,
      purchaseDiscountAmount: body.purchaseDiscountAmount ?? 0,
      purchaseDiscountPercent: body.purchaseDiscountPercent ?? 0,
      standardSupplyPrice: body.standardSupplyPrice ?? null,
      supplyDiscountAmount: body.supplyDiscountAmount ?? 0,
      supplyDiscountPercent: body.supplyDiscountPercent ?? 0,
      recommendedRetailPrice: body.recommendedRetailPrice ?? null,
    });
    const errs = issues.filter((i) => i.severity === 'error');
    if (errs.length > 0) {
      return NextResponse.json(
        { error: 'PRICING_INVALID', detail: errs },
        { status: 400 },
      );
    }
  }

  const [row] = await db
    .update(lenses)
    .set(allowed)
    .where(eq(lenses.id, params.id))
    .returning();

  if (!row) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  // 가격 entry 생성 (각 영역 — 변경 여부 무관하게 body 에 명시되면 기록).
  // 시작/종료일 정보가 변경 추적의 핵심 단서.
  if ('standardCost' in body && body.standardCost != null) {
    await createPriceEntryAndSyncCache(row.id, {
      scope: 'purchase',
      standard: Number(body.standardCost),
      discountAmount: body.purchaseDiscountAmount ?? 0,
      discountPercent: body.purchaseDiscountPercent ?? 0,
      startsAt: body.purchaseStartsAt ?? null,
      endsAt: body.purchaseEndsAt ?? null,
      createdBy: user.id,
    });
  }
  if ('standardSupplyPrice' in body && body.standardSupplyPrice != null) {
    await createPriceEntryAndSyncCache(row.id, {
      scope: 'supply',
      standard: Number(body.standardSupplyPrice),
      discountAmount: body.supplyDiscountAmount ?? 0,
      discountPercent: body.supplyDiscountPercent ?? 0,
      startsAt: body.supplyStartsAt ?? null,
      endsAt: body.supplyEndsAt ?? null,
      createdBy: user.id,
    });
  }
  if ('recommendedRetailPrice' in body && body.recommendedRetailPrice != null) {
    await createPriceEntryAndSyncCache(row.id, {
      scope: 'retail',
      standard: Number(body.recommendedRetailPrice),
      startsAt: body.retailStartsAt ?? null,
      endsAt: body.retailEndsAt ?? null,
      createdBy: user.id,
    });
  }

  return NextResponse.json({ lens: row });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  await db
    .update(lenses)
    .set({ deletedAt: new Date(), isActive: false })
    .where(eq(lenses.id, params.id));

  return NextResponse.json({ ok: true });
}
