/**
 * 가격 모델 — 매입 / 공급 / 소비자 + 부가세 + 검증.
 *
 * 사용자 요구 (확정 2026-05-19):
 *  - DB 저장 가격은 모두 부가세 포함 (한국 회계 관행)
 *  - UI 의 매입/공급 영역만 부가세 별도 토글로 환산 표시 가능
 *  - 소비자 영역은 항상 부가세 포함 (소매 표준)
 *
 * 정수 (KRW) 기준. 부가세 환산 시 Math.round 로 정수화.
 */

export const VAT_RATE = 0.1;

/** 부가세 포함 금액 → 부가세 별도 금액 (정수 반올림). */
export function toVatExcluded(included: number | null | undefined): number {
  if (!included) return 0;
  return Math.round(included / (1 + VAT_RATE));
}

/** 부가세 별도 금액 → 부가세 포함 금액 (정수 반올림). */
export function toVatIncluded(excluded: number | null | undefined): number {
  if (!excluded) return 0;
  return Math.round(excluded * (1 + VAT_RATE));
}

/** 부가세 포함 금액에서 부가세 만 추출. */
export function vatAmount(included: number | null | undefined): number {
  if (!included) return 0;
  return included - toVatExcluded(included);
}

/**
 * 표준가 + 할인 (금액 OR 백분율) → 실효가.
 * 두 할인이 동시 입력되면 합산 (금액 + 백분율 둘 다 적용).
 * 결과는 0 이상 (음수 방지).
 */
export function applyDiscount(
  standard: number | null | undefined,
  discountAmount: number | null | undefined,
  discountPercent: number | null | undefined,
): number {
  const s = standard ?? 0;
  if (s <= 0) return 0;
  const da = Math.max(0, discountAmount ?? 0);
  const dp = Math.min(100, Math.max(0, discountPercent ?? 0));
  const afterPercent = Math.round(s * (1 - dp / 100));
  const result = afterPercent - da;
  return Math.max(0, result);
}

/** 매입가 = standardCost - 매입할인 */
export function effectivePurchaseCost(
  standardCost: number | null | undefined,
  discountAmount: number | null | undefined,
  discountPercent: number | null | undefined,
): number {
  return applyDiscount(standardCost, discountAmount, discountPercent);
}

/** 할인공급가 = standardSupplyPrice - 공급할인 */
export function effectiveSupplyPrice(
  standardSupplyPrice: number | null | undefined,
  discountAmount: number | null | undefined,
  discountPercent: number | null | undefined,
): number {
  return applyDiscount(standardSupplyPrice, discountAmount, discountPercent);
}

/** 마진율 (%) — (판매가 - 원가) / 판매가 * 100. 0 미만이면 역마진. */
export function marginRate(sale: number, cost: number): number {
  if (sale <= 0) return 0;
  return Math.round(((sale - cost) / sale) * 10000) / 100; // 소수 둘째 자리
}

/** 마진율 = 가맹점 공급가 vs 매입가 — 본사 마진. */
export function supplyMarginRate(supplyPrice: number, purchaseCost: number): number {
  return marginRate(supplyPrice, purchaseCost);
}

/** 마진율 = 권장소비자가 vs 가맹점 공급가 — 가맹점 마진. */
export function retailMarginRate(retailPrice: number, supplyPrice: number): number {
  return marginRate(retailPrice, supplyPrice);
}

/**
 * 1+1, 2+1 등 물량 할증을 반영한 단위 원가.
 * 예: buy=1, free=1 → 2개 받는데 매입은 1개 분량 → 단위 원가 = 매입가 / 2.
 * 결과는 부가세 포함 그대로 (포함끼리 환산).
 */
export function bundleAdjustedUnitCost(
  unitCost: number,
  buyQty: number | null | undefined,
  freeQty: number | null | undefined,
): number {
  const b = Math.max(1, buyQty ?? 1);
  const f = Math.max(0, freeQty ?? 0);
  if (b + f <= 0) return unitCost;
  return Math.round((unitCost * b) / (b + f));
}

// ===== 검증 =====

export interface PricingInput {
  standardCost?: number | null;
  purchaseDiscountAmount?: number | null;
  purchaseDiscountPercent?: number | null;
  standardSupplyPrice?: number | null;
  supplyDiscountAmount?: number | null;
  supplyDiscountPercent?: number | null;
  recommendedRetailPrice?: number | null;
}

export interface PricingIssue {
  field?: keyof PricingInput;
  severity: 'error' | 'warn';
  message: string;
}

/**
 * 가격 입력 검증.
 *  - error: 저장 차단 (음수, % 범위 초과, 할인이 표준가 초과)
 *  - warn: 사용자 확인용 (역마진, 매입가 > 공급가 등)
 */
export function validatePricing(input: PricingInput): PricingIssue[] {
  const issues: PricingIssue[] = [];

  const checkNonNegative = (v: number | null | undefined, field: keyof PricingInput, label: string) => {
    if (v != null && v < 0) {
      issues.push({ field, severity: 'error', message: `${label} 는 0 이상이어야 합니다` });
    }
  };
  const checkPercentRange = (v: number | null | undefined, field: keyof PricingInput, label: string) => {
    if (v != null && (v < 0 || v > 100)) {
      issues.push({ field, severity: 'error', message: `${label} 는 0-100 사이여야 합니다` });
    }
  };

  checkNonNegative(input.standardCost, 'standardCost', '표준매입가');
  checkNonNegative(input.purchaseDiscountAmount, 'purchaseDiscountAmount', '매입할인 금액');
  checkPercentRange(input.purchaseDiscountPercent, 'purchaseDiscountPercent', '매입할인 %');
  checkNonNegative(input.standardSupplyPrice, 'standardSupplyPrice', '표준공급가');
  checkNonNegative(input.supplyDiscountAmount, 'supplyDiscountAmount', '공급할인 금액');
  checkPercentRange(input.supplyDiscountPercent, 'supplyDiscountPercent', '공급할인 %');
  checkNonNegative(input.recommendedRetailPrice, 'recommendedRetailPrice', '권장소비자가');

  // 할인이 표준가 초과 (실효가 0 미만이 될 케이스)
  if (input.standardCost && input.purchaseDiscountAmount && input.purchaseDiscountAmount > input.standardCost) {
    issues.push({
      field: 'purchaseDiscountAmount',
      severity: 'error',
      message: '매입할인 금액이 표준매입가를 초과합니다',
    });
  }
  if (
    input.standardSupplyPrice &&
    input.supplyDiscountAmount &&
    input.supplyDiscountAmount > input.standardSupplyPrice
  ) {
    issues.push({
      field: 'supplyDiscountAmount',
      severity: 'error',
      message: '공급할인 금액이 표준공급가를 초과합니다',
    });
  }

  // 역마진 경고
  const cost = effectivePurchaseCost(
    input.standardCost,
    input.purchaseDiscountAmount,
    input.purchaseDiscountPercent,
  );
  const supply = effectiveSupplyPrice(
    input.standardSupplyPrice,
    input.supplyDiscountAmount,
    input.supplyDiscountPercent,
  );
  if (cost > 0 && supply > 0 && supply < cost) {
    issues.push({
      severity: 'warn',
      message: `공급가(${supply.toLocaleString()})가 매입가(${cost.toLocaleString()})보다 낮음 — 본사 역마진`,
    });
  }
  if (supply > 0 && input.recommendedRetailPrice != null && input.recommendedRetailPrice < supply) {
    issues.push({
      severity: 'warn',
      message: `권장소비자가(${input.recommendedRetailPrice.toLocaleString()})가 공급가(${supply.toLocaleString()})보다 낮음 — 가맹점 역마진`,
    });
  }

  return issues;
}

/** 한 번의 round-trip 으로 토글 환산 확인 (정수 정확성). */
export function vatToggleRoundTripIsLossy(included: number): boolean {
  return toVatIncluded(toVatExcluded(included)) !== included;
}
