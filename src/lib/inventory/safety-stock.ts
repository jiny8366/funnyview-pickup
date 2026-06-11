/**
 * 안전재고 권고 기준 — 표준 재고이론 기반 (JINY 지시: 판매량 측정 후 도수별 기준 수립).
 *
 * 채택 공식 (통계적 안전재고, 서비스레벨 방식):
 *   안전재고 SS = Z × σd × √LT
 *     · Z   = 서비스레벨 계수 (기본 95% → 1.65. 90%=1.28, 99%=2.33)
 *     · σd  = 일별 판매량 표준편차 (관측창 동안, 판매 없는 날 0 포함)
 *     · LT  = 보충 리드타임(일) — 매입처 발주→입고. 기본 7일
 *   재주문점 ROP = 일평균판매 × LT + SS  (참고 지표로 함께 제공)
 *
 * 판매량 산정: inventory_movements 의 outbound(고객 배송 + B2B 발주 출고 모두) 일별 합계.
 *
 * 데이터 부족 폴백 (런칭 초기 — 통계가 성립하지 않는 경우):
 *   · 관측창 내 총판매 0 → 권고 0 (판매 없는 도수에 안전재고 불필요)
 *   · 판매일수 < MIN_SALE_DAYS(3) → σ 신뢰 불가 → 권고 = ceil(일평균 × LT) 단순법
 *   · 그 외 → 공식 적용, 권고 = ceil(SS)
 *
 * 기본 파라미터는 운영하며 조정 가능 — 변경 시 이 파일 한 곳만.
 */

export const SAFETY_STOCK_PARAMS = {
  /** 서비스레벨 95% (Z=1.65) — 픽업 약속을 지키는 충족률 목표 */
  serviceZ: 1.65,
  /** 보충 리드타임(일) — 매입처 발주 후 입고까지 */
  leadTimeDays: 7,
  /** 판매량 관측창(일) */
  windowDays: 30,
  /** 통계 공식을 적용할 최소 판매일수 — 미만이면 단순법 폴백 */
  minSaleDays: 3,
} as const;

export interface DemandStats {
  /** 관측창 내 총판매량 */
  totalQty: number;
  /** 판매가 있었던 일수 */
  saleDays: number;
  /** Σ(일판매량²) — 0판매일 포함 표준편차 계산용 */
  sumSq: number;
}

export interface SafetyStockAdvice {
  /** 권고 안전재고 (팩) */
  recommended: number;
  /** 일평균 판매량 (0판매일 포함) */
  avgDaily: number;
  /** 재주문점 (참고) */
  reorderPoint: number;
  /** 산출 방법 — 'statistical' | 'simple'(데이터부족 폴백) | 'none'(판매없음) */
  method: 'statistical' | 'simple' | 'none';
}

export function adviseSafetyStock(
  stats: DemandStats,
  params = SAFETY_STOCK_PARAMS,
): SafetyStockAdvice {
  const { serviceZ, leadTimeDays, windowDays, minSaleDays } = params;
  const n = windowDays;
  const avgDaily = stats.totalQty / n;

  if (stats.totalQty <= 0) {
    return { recommended: 0, avgDaily: 0, reorderPoint: 0, method: 'none' };
  }

  if (stats.saleDays < minSaleDays) {
    // 단순법: 리드타임 동안의 평균 수요만 확보
    const ss = Math.ceil(avgDaily * leadTimeDays);
    return {
      recommended: Math.max(1, ss),
      avgDaily,
      reorderPoint: Math.max(1, ss),
      method: 'simple',
    };
  }

  // 0판매일 포함 표본 표준편차: σ² = (Σq² − n·avg²) / (n − 1)
  const variance = Math.max(0, (stats.sumSq - n * avgDaily * avgDaily) / (n - 1));
  const sigma = Math.sqrt(variance);
  const ss = Math.ceil(serviceZ * sigma * Math.sqrt(leadTimeDays));
  const rop = Math.ceil(avgDaily * leadTimeDays + ss);
  return { recommended: Math.max(1, ss), avgDaily, reorderPoint: rop, method: 'statistical' };
}
