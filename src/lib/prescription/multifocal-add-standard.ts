/**
 * 멀티포컬 가입도(ADD) 적합 표준 — 🔒 JINY 확정 (2026-06-11) 변경 금지.
 *
 * 근거: 제조사 공식 피팅 가이드 (웹 공식자료 검증 완료)
 *   · 알콘 DAILIES TOTAL1 / 에어옵틱스 멀티포컬 피팅 가이드
 *   · 아큐브(J&J) 멀티포컬 피팅 차트
 *   · 바슈롬 ULTRA/Biotrue for Presbyopia 피팅 가이드
 *
 * ⚠️ 이 수치를 바꾸려면: ① JINY 승인 ② docs/spec.json 의 multifocalAddStandard 동시 수정
 *    ③ scripts/verify-multifocal-standard.ts 통과 — 세 가지가 모두 필요하다.
 *    (검증 스크립트가 이 표의 기대값을 고정하고 있어 임의 변경 시 실패한다.)
 */

export type AddGrade = 'LOW' | 'MID' | 'HIGH';
export type GradeRange = readonly [number, number];

/** 수치 ADD 적합 허용 — 처방 대비 비대칭 [−0.25, +0.50] (낮은 등급 우선 임상 원칙) */
export const ADD_FIT_BELOW = 0.25;
export const ADD_FIT_ABOVE = 0.5;

/** 처방 ADD 유효 범위 — 밖이면 가장 가까운 끝으로 클램프 */
export const RX_ADD_MIN = 0.75;
export const RX_ADD_MAX = 2.5;

/** 제조사 공식 등급↔처방 ADD 차트 (동결) */
export const GRADE_CHARTS = Object.freeze({
  /** 알콘 (DT1·에어옵틱스 하이드라): LO ≤+1.25 / MED +1.50~+2.00 / HI +2.25~+2.50 */
  alcon: Object.freeze({
    LOW: [0.75, 1.25],
    MID: [1.5, 2.0],
    HIGH: [2.25, 2.5],
  } as Record<AddGrade, GradeRange>),
  /** 아큐브 (J&J): LOW +0.75~+1.25 / MID +1.50~+1.75 / HIGH +2.00~+2.50 */
  jnj: Object.freeze({
    LOW: [0.75, 1.25],
    MID: [1.5, 1.75],
    HIGH: [2.0, 2.5],
  } as Record<AddGrade, GradeRange>),
  /** 바슈롬 (울트라·바이오트루, 2등급): LOW +0.75~+1.50 / HIGH +1.75~+2.50 */
  bausch: Object.freeze({
    LOW: [0.75, 1.5],
    HIGH: [1.75, 2.5],
  } as Partial<Record<AddGrade, GradeRange>>),
});

/** 브랜드 → 적용 차트. 미등재 3등급 브랜드는 알콘 표를 일반 근사로 사용. */
export function gradeChartForBrand(brand: string): Partial<Record<AddGrade, GradeRange>> {
  if (brand.includes('바슈롬')) return GRADE_CHARTS.bausch;
  if (brand.includes('아큐브')) return GRADE_CHARTS.jnj;
  return GRADE_CHARTS.alcon;
}

/** 제품명/제품코드에서 가입도 등급 토큰 파싱 (HIGH/HIG/MID/MED/LOW, 코드 접미 -H/-M/-L) */
export function parseAddGrade(name: string, productCode: string): AddGrade | null {
  const n = name.toUpperCase();
  if (/HIGH|HIG\b|\(H\)/.test(n) || /-H$/.test(productCode)) return 'HIGH';
  if (/MID|MED\b|\(M\)/.test(n) || /-M$/.test(productCode)) return 'MID';
  if (/LOW|\(L\)/.test(n) || /-L$/.test(productCode)) return 'LOW';
  return null;
}

/** 처방 ADD 를 유효 범위로 클램프 (0.25 스텝 처방 전제) */
export function clampRxAdd(rxAdd: number): number {
  return Math.min(RX_ADD_MAX, Math.max(RX_ADD_MIN, rxAdd));
}

/** 등급 적합 — 공식 차트 범위 정확 포함 (범위가 0.25 스텝으로 빈틈없이 이어짐) */
export function fitsGrade(range: GradeRange, rxAdd: number): boolean {
  const rx = clampRxAdd(rxAdd);
  return rx >= range[0] && rx <= range[1];
}

/** 수치 적합 — 비대칭 허용 [rx−0.25, rx+0.50] */
export function fitsNumeric(adds: number[], rxAdd: number): boolean {
  return adds.some((a) => a >= rxAdd - ADD_FIT_BELOW && a <= rxAdd + ADD_FIT_ABOVE);
}
