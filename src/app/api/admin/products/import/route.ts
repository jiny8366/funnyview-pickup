import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import type { PriceScope } from '@/db/schema';
import { db } from '@/db/client';
import { lenses } from '@/db/schema';
import { requirePermissionForApi } from '@/lib/auth/guards';
import { parseCsv } from '@/lib/csv';
import { createPriceEntryAndSyncCache } from '@/lib/lens-pricing-entries';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const truthy = (v: string) => /^(true|1|y|yes|예|o|on)$/i.test(v.trim());

export async function POST(req: Request) {
  const me = await requirePermissionForApi('products_write');
  if (!me) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });

  const text = await req.text();
  if (!text.trim()) {
    return NextResponse.json({ error: '빈 파일입니다.' }, { status: 400 });
  }
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return NextResponse.json({ error: '데이터 행이 없습니다.' }, { status: 400 });
  }

  let updated = 0;
  let priceChanged = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const code = (row.productCode ?? '').trim();
    if (!code) continue;
    const [lens] = await db
      .select()
      .from(lenses)
      .where(and(eq(lenses.productCode, code), isNull(lenses.deletedAt)))
      .limit(1);
    if (!lens) {
      errors.push(`${code}: 제품을 찾을 수 없음`);
      continue;
    }

    // 1) 직접 수정 가능한 컬럼 (구조/식별자 제외)
    const direct: Record<string, unknown> = {};
    const has = (k: string) => row[k] !== undefined && row[k] !== '';
    const strFields = [
      'name', 'material', 'manufacturer', 'mfdsPermitNo',
      'mfdsClassificationCode', 'mfdsProductName', 'colorName', 'colorHex', 'seriesCode',
    ];
    for (const k of strFields) if (has(k)) direct[k] = row[k];
    // numeric(소수) — 문자열로 저장
    for (const k of ['waterContent', 'baseCurve', 'diameter', 'sphereMin', 'sphereMax']) {
      if (has(k)) direct[k] = row[k];
    }
    for (const k of ['price', 'cost', 'oxygenDkt']) {
      if (has(k) && Number.isFinite(Number(row[k]))) direct[k] = Number(row[k]);
    }
    for (const k of ['uvProtection', 'blueLight', 'isNew', 'isActive']) {
      if (has(k)) direct[k] = truthy(row[k]);
    }
    if (Object.keys(direct).length > 0) {
      direct.updatedAt = new Date();
      await db.update(lenses).set(direct).where(eq(lenses.id, lens.id));
    }

    // 2) 가격은 price entry 흐름(이력+캐시) — 표준가가 바뀌었을 때만 기록
    const applyPrice = async (
      scope: PriceScope,
      stdKey: string,
      curr: number | null,
      daKey?: string,
      dpKey?: string,
    ) => {
      if (!has(stdKey)) return;
      const standard = Number(row[stdKey]);
      if (!Number.isFinite(standard)) return;
      const da = daKey && has(daKey) ? Number(row[daKey]) : 0;
      const dp = dpKey && has(dpKey) ? Number(row[dpKey]) : 0;
      if (standard === (curr ?? 0)) return; // 변경 없음
      await createPriceEntryAndSyncCache(lens.id, {
        scope,
        standard,
        discountAmount: da,
        discountPercent: dp,
        note: '엑셀 일괄 업로드',
        createdBy: me.id,
      });
      priceChanged++;
    };
    await applyPrice('purchase', 'standardCost', lens.standardCost, 'purchaseDiscountAmount', 'purchaseDiscountPercent');
    await applyPrice('supply', 'standardSupplyPrice', lens.standardSupplyPrice, 'supplyDiscountAmount', 'supplyDiscountPercent');
    await applyPrice('retail', 'recommendedRetailPrice', lens.recommendedRetailPrice);

    updated++;
  }

  return NextResponse.json({ updated, priceChanged, failed: errors.length, errors: errors.slice(0, 20) });
}
