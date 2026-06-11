/**
 * 픽업가맹점 정산 수수료율 해석 (commission hierarchy resolver).
 *
 * 특정 (매장, 제품) 조합에 대한 "효과 수수료율(%)"을 가장 구체적인 수준부터
 * 다음 순서로 fallback 하며 결정한다:
 *
 *   1. 매장 × 제품 오버라이드 (store_product_commissions)        — 가장 구체적
 *   2. 그룹 × 제품 오버라이드 (group_product_commissions, 매장의 소속 그룹)
 *   3. 매장 전체 수수료율 (stores.commission_rate, > 0 일 때만 "설정됨"으로 간주)
 *   4. 그룹 전체 수수료율 (store_groups.commission_rate)
 *   5. 0 (그 무엇도 없으면)
 *
 * 모든 값의 단위는 % 이다. 매장/그룹 "전체" 수수료율(3·4)은 0(또는 미설정)을
 * "설정 안 됨"으로 보아 다음 단계로 넘어간다. 단, 제품 오버라이드(1·2)는
 * 0% 도 명시적으로 "0% 로 설정"한 의미이므로 그대로 채택한다(존재하면 우선).
 *
 * NOTE: 본 util 은 향후 정산 통합 및 UI 미리보기를 위한 순수 함수다.
 *       현재 정산(src/app/api/admin/dashboard/route.ts)에는 아직 연결되지 않았다.
 */

export interface CommissionResolveInput {
  /** 매장 × 제품 오버라이드율 (%) — 없으면 null/undefined */
  storeProduct?: number | string | null;
  /** 그룹 × 제품 오버라이드율 (%) — 없으면 null/undefined */
  groupProduct?: number | string | null;
  /** 매장 전체 수수료율 (%) — 0 또는 미설정이면 fallback */
  storeRate?: number | string | null;
  /** 그룹 전체 수수료율 (%) — 0 또는 미설정이면 0 으로 귀결 */
  groupRate?: number | string | null;
}

function toNum(v: number | string | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * 효과 수수료율(%)을 계층 규칙(위 1~5)에 따라 해석한다.
 *
 * @example
 * resolveCommissionRate({ storeProduct: 12 }) // => 12
 * resolveCommissionRate({ groupProduct: 8, storeRate: 10 }) // => 8
 * resolveCommissionRate({ storeRate: 0, groupRate: 5 }) // => 5
 * resolveCommissionRate({}) // => 0
 */
export function resolveCommissionRate(input: CommissionResolveInput): number {
  // 1. 매장 × 제품 오버라이드 (존재하면 0% 라도 채택)
  const storeProduct = toNum(input.storeProduct);
  if (storeProduct != null) return storeProduct;

  // 2. 그룹 × 제품 오버라이드 (존재하면 0% 라도 채택)
  const groupProduct = toNum(input.groupProduct);
  if (groupProduct != null) return groupProduct;

  // 3. 매장 전체 수수료율 (> 0 일 때만 설정됨으로 간주)
  const storeRate = toNum(input.storeRate);
  if (storeRate != null && storeRate > 0) return storeRate;

  // 4. 그룹 전체 수수료율 (> 0 일 때만 설정됨으로 간주)
  const groupRate = toNum(input.groupRate);
  if (groupRate != null && groupRate > 0) return groupRate;

  // 5. 기본값
  return 0;
}

/**
 * (매장, 제품) 조합의 "효과 공급가(원, KRW)" 를 가장 구체적인 수준부터
 * 해석한다. 할인율과 동일하게 most-specific-wins:
 *
 *   1. 매장 × 제품 공급가 (store_product_commissions.supply_price)  — 가장 구체적
 *   2. 그룹 × 제품 공급가 (group_product_commissions.supply_price)
 *   3. null (그 무엇도 없으면 — 공급가는 매장/그룹 "전체" 개념이 없다)
 *
 * 공급가는 명시적으로 입력했을 때만 존재한다(없으면 null). 0 도 유효한 값으로 본다.
 */
export interface SupplyPriceResolveInput {
  /** 매장 × 제품 공급가 (원) — 없으면 null/undefined */
  storeProduct?: number | string | null;
  /** 그룹 × 제품 공급가 (원) — 없으면 null/undefined */
  groupProduct?: number | string | null;
}

export function resolveSupplyPrice(input: SupplyPriceResolveInput): number | null {
  const storeProduct = toNum(input.storeProduct);
  if (storeProduct != null) return storeProduct;

  const groupProduct = toNum(input.groupProduct);
  if (groupProduct != null) return groupProduct;

  return null;
}

export interface EffectiveCommissionInput
  extends CommissionResolveInput {
  /** 매장 × 제품 공급가 (원) */
  storeProductSupplyPrice?: number | string | null;
  /** 그룹 × 제품 공급가 (원) */
  groupProductSupplyPrice?: number | string | null;
}

export interface EffectiveCommission {
  /** 효과 할인율(수수료율, %) */
  rate: number;
  /** 효과 공급가(원). 미설정이면 null. */
  supplyPrice: number | null;
}

/**
 * 효과 할인율 + 효과 공급가를 함께 해석한다.
 *
 * 정산(미연결) 시 적용 규칙: **공급가 우선** — supplyPrice 가 있으면 공급가로
 * 정산하고, 없으면(null) rate(할인율)로 정산한다. 본 util 은 순수 함수이며
 * 정산/대시보드(src/app/api/admin/dashboard/route.ts)에는 연결하지 않는다.
 */
export function resolveEffectiveCommission(
  input: EffectiveCommissionInput,
): EffectiveCommission {
  return {
    rate: resolveCommissionRate(input),
    supplyPrice: resolveSupplyPrice({
      storeProduct: input.storeProductSupplyPrice,
      groupProduct: input.groupProductSupplyPrice,
    }),
  };
}
