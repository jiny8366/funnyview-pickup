/**
 * 가맹점(store) 공급가(supply price) 해석 — 단일 진실의 출처.
 *
 * ⚠️ 안전 원칙: 가맹점에 표시·청구되는 가격은 **공급가(supply price)** 이며,
 *    소비자 retail 가격(recommendedRetailPrice / lens_price_entries scope='retail')
 *    과 **완전히 분리**된다. 본 모듈은 retail 가격을 절대 import/참조하지 않는다.
 *    (모듈 경계 + 네이밍으로 분리를 강제)
 *
 * 공급가 결정 체인 (가장 구체적인 것 우선, most-specific wins):
 *   1. 매장 × 제품 공급가  — store_product_commissions.supply_price (storeId, lensId)
 *   2. 그룹 × 제품 공급가  — group_product_commissions.supply_price (그룹 + lensId)
 *   3. 제품 마스터 기준    — lenses.standard_supply_price − 공급할인
 *                            (supply_discount_amount, supply_discount_percent)
 *
 * retail 로 fallback 하지 않는다. 1·2 는 명시적으로 설정된 값이면 0 도 채택한다.
 */

function toNum(v: number | string | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export interface StoreSupplyPriceInput {
  /** 매장 × 제품 공급가 (원) — store_product_commissions.supply_price */
  storeProduct?: number | string | null;
  /** 그룹 × 제품 공급가 (원) — group_product_commissions.supply_price */
  groupProduct?: number | string | null;
  /** 제품 마스터 기준 정보 — lenses */
  master?: {
    standardSupplyPrice?: number | string | null;
    supplyDiscountAmount?: number | string | null;
    supplyDiscountPercent?: number | string | null;
  } | null;
}

/**
 * 제품 마스터 기준 공급가 = standardSupplyPrice − 정액할인 − 정률할인.
 * standardSupplyPrice 가 없으면 null(가격문의).
 */
export function resolveMasterSupplyPrice(
  master: StoreSupplyPriceInput['master'],
): number | null {
  if (!master) return null;
  const base = toNum(master.standardSupplyPrice);
  if (base == null) return null;

  const amount = toNum(master.supplyDiscountAmount) ?? 0;
  const percent = toNum(master.supplyDiscountPercent) ?? 0;

  let price = base - amount;
  if (percent > 0) {
    price = price - Math.round((price * percent) / 100);
  }
  return Math.max(0, Math.round(price));
}

/**
 * 가맹점 공급가를 3단계 체인으로 해석한다.
 * 어느 단계도 값이 없으면 null(가격문의) — retail 로 fallback 하지 않는다.
 */
export function resolveStoreSupplyPrice(input: StoreSupplyPriceInput): number | null {
  const storeProduct = toNum(input.storeProduct);
  if (storeProduct != null) return Math.max(0, Math.round(storeProduct));

  const groupProduct = toNum(input.groupProduct);
  if (groupProduct != null) return Math.max(0, Math.round(groupProduct));

  return resolveMasterSupplyPrice(input.master);
}

// ───────────────────────────────────────────────────────────────────────────
// DB 헬퍼 — 가맹점 카탈로그 (공급가 해석 적용)
// retail 가격 컬럼(recommendedRetailPrice / price)은 select 하지 않는다.
// ───────────────────────────────────────────────────────────────────────────

import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  groupProductCommissions,
  lenses,
  storeProductCommissions,
  stores,
} from '@/db/schema';

export interface StoreCatalogItem {
  id: string;
  productCode: string;
  brand: string;
  name: string;
  lensType: string;
  replacementCycle: string;
  piecesPerBox: number;
  imageUrl: string | null;
  colorName: string | null;
  colorHex: string | null;
  colorPreviewUrl: string | null;
  diameter: string | null;
  /** 해석된 가맹점 공급가 (원). 미설정이면 null(가격문의). */
  supplyPrice: number | null;
}

/**
 * 특정 가맹점의 활성 제품 카탈로그를 공급가와 함께 반환한다.
 * store×product, group×product 오버라이드를 left-join 하고 제품 마스터로 fallback.
 * **retail 가격 필드는 절대 포함하지 않는다.**
 */
export async function getStoreCatalog(storeId: string): Promise<StoreCatalogItem[]> {
  // 매장의 소속 그룹 조회 (group×product 오버라이드 join 용)
  const [storeRow] = await db
    .select({ groupId: stores.groupId })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1);
  const groupId = storeRow?.groupId ?? null;

  const rows = await db
    .select({
      id: lenses.id,
      productCode: lenses.productCode,
      brand: lenses.brand,
      name: lenses.name,
      lensType: lenses.lensType,
      replacementCycle: lenses.replacementCycle,
      piecesPerBox: lenses.piecesPerBox,
      imageUrl: lenses.imageUrl,
      colorName: lenses.colorName,
      colorHex: lenses.colorHex,
      colorPreviewUrl: lenses.colorPreviewUrl,
      diameter: lenses.diameter,
      // 공급가 해석 입력 (retail 제외)
      standardSupplyPrice: lenses.standardSupplyPrice,
      supplyDiscountAmount: lenses.supplyDiscountAmount,
      supplyDiscountPercent: lenses.supplyDiscountPercent,
      storeSupplyPrice: storeProductCommissions.supplyPrice,
      groupSupplyPrice: groupProductCommissions.supplyPrice,
    })
    .from(lenses)
    .leftJoin(
      storeProductCommissions,
      and(
        eq(storeProductCommissions.lensId, lenses.id),
        eq(storeProductCommissions.storeId, storeId),
      ),
    )
    .leftJoin(
      groupProductCommissions,
      groupId
        ? and(
            eq(groupProductCommissions.lensId, lenses.id),
            eq(groupProductCommissions.groupId, groupId),
          )
        : // 그룹 없으면 join 결과가 항상 비도록
          sql`false`,
    )
    .where(and(eq(lenses.isActive, true), isNull(lenses.deletedAt)))
    .orderBy(lenses.brand, lenses.name);

  return rows.map((r) => ({
    id: r.id,
    productCode: r.productCode,
    brand: r.brand,
    name: r.name,
    lensType: r.lensType,
    replacementCycle: r.replacementCycle,
    piecesPerBox: r.piecesPerBox,
    imageUrl: r.imageUrl,
    colorName: r.colorName,
    colorHex: r.colorHex,
    colorPreviewUrl: r.colorPreviewUrl,
    diameter: r.diameter,
    supplyPrice: resolveStoreSupplyPrice({
      storeProduct: r.storeSupplyPrice,
      groupProduct: groupId ? r.groupSupplyPrice : null,
      master: {
        standardSupplyPrice: r.standardSupplyPrice,
        supplyDiscountAmount: r.supplyDiscountAmount,
        supplyDiscountPercent: r.supplyDiscountPercent,
      },
    }),
  }));
}
