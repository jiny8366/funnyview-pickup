/**
 * 안경 도수 → 콘택트렌즈 도수 변환.
 *
 * 원리: 안경은 정점간거리(각막~렌즈, 통상 12mm)만큼 떨어져 있어, 같은 교정력이라도
 * 각막 위에 놓이는 콘택트와 유효 도수가 다르다. 정점 보정 공식으로 환산한다.
 *
 *   F_contact = F_spec / (1 - d · F_spec),  d = 0.012m
 *
 * ±4.00D 미만은 보정량이 미미해 사실상 동일, 그 이상부터 의미 있는 차이가 난다.
 * 아큐브 등에서 제공하는 도수변환표도 동일한 정점 보정에 기반한다.
 * 결과는 처방 단위인 0.25D 로 반올림한다.
 */

const VERTEX_M = 0.012;

export function vertexCorrect(powerD: number): number {
  if (!powerD) return 0;
  return powerD / (1 - VERTEX_M * powerD);
}

export function roundQuarter(v: number): number {
  return Math.round(v * 4) / 4;
}

export interface EyePower {
  sphere: number;
  cylinder: number | null;
  axis: number | null;
  addPower: number | null;
}

/** 일반 난시용(토릭) 콘택트렌즈의 가용 CYL 단계 (절댓값). 아큐브/바슈롬 등 공통 범위. */
const TORIC_CYL_STEPS = [0.75, 1.25, 1.75, 2.25];

/** 안경 난시 도수를 토릭 콘택트 가용 CYL 로 매핑. |CYL| < 0.5 면 0(구면 취급). */
export function mapToricCylinder(cyl: number): number {
  const abs = Math.abs(cyl);
  if (abs < 0.5) return 0;
  let closest = TORIC_CYL_STEPS[0];
  for (const s of TORIC_CYL_STEPS) {
    if (Math.abs(s - abs) < Math.abs(closest - abs)) closest = s;
  }
  return -closest;
}

/**
 * 안경 → 난시용(토릭) 콘택트 변환.
 * 1) 두 주경선(SPH, SPH+CYL)을 각각 정점 보정
 * 2) 난시를 토릭 콘택트 가용 CYL 로 매핑
 * 3) 구면등가(SE) 보존을 위해 CYL 변경분의 절반을 SPH 에 보정
 * 난시가 미미(|CYL|<0.5)하면 구면등가로 떨어뜨려 구면 렌즈 도수를 돌려준다.
 */
export function glassesToContactToric(p: EyePower): EyePower {
  const s = p.sphere;
  const c = p.cylinder ?? 0;
  const m1 = vertexCorrect(s);
  const m2 = vertexCorrect(s + c);
  const vSphere = m1;
  const vCyl = m2 - m1;
  if (Math.abs(vCyl) < 0.5) {
    return {
      sphere: roundQuarter(vSphere + vCyl / 2),
      cylinder: null,
      axis: null,
      addPower: p.addPower,
    };
  }
  const mappedCyl = mapToricCylinder(vCyl);
  const adjustedSphere = vSphere + (vCyl - mappedCyl) / 2; // SE 보존
  return {
    sphere: roundQuarter(adjustedSphere),
    cylinder: roundQuarter(mappedCyl),
    axis: p.axis,
    addPower: p.addPower,
  };
}

/**
 * 안경 → 구면등가(SE) 콘택트 변환. 정점 보정 후 SE = SPH + CYL/2, 난시는 제거.
 * 구면(난시 비교정) 콘택트를 선택할 때 사용.
 */
export function glassesToContactSphericalEquivalent(p: EyePower): EyePower {
  const s = p.sphere;
  const c = p.cylinder ?? 0;
  const m1 = vertexCorrect(s);
  const m2 = vertexCorrect(s + c);
  const se = m1 + (m2 - m1) / 2;
  return {
    sphere: roundQuarter(se),
    cylinder: null,
    axis: null,
    addPower: p.addPower,
  };
}

/** 도수 숫자를 처방 표기 문자열로 (+0.00 / −3.75) — 화면 표시용(− 기호). */
export function formatDiopter(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${sign}${Math.abs(v).toFixed(2)}`;
}

/** 폼 입력/저장용 부호 문자열 (ASCII +/-): -3.00 / +1.00 / 0.00 */
export function signedDiopterString(v: number): string {
  if (v === 0) return '0.00';
  return (v > 0 ? '+' : '-') + Math.abs(v).toFixed(2);
}

function parseDigits(raw: string): number | null {
  const digits = raw.replace(/[^0-9.]/g, '');
  if (!digits) return null;
  // 소수점이 있으면 그대로(3.00), 없으면 100으로 나눔(300 → 3.00)
  const val = digits.includes('.') ? parseFloat(digits) : parseInt(digits, 10) / 100;
  return Number.isFinite(val) ? val : null;
}

/**
 * SPH/CYL 입력 정규화. 0.25 단위 반올림, 부호 없으면 음수(근시) 기본, '+' 명시 시 양수.
 *   "300" → "-3.00",  "075" → "-0.75",  "+100" → "+1.00",  "0" → "0.00"
 */
export function normalizeSignedDiopter(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  const hasPlus = t.includes('+');
  const v = parseDigits(t);
  if (v === null) return '';
  const rounded = roundQuarter(Math.abs(v));
  if (rounded === 0) return '0.00';
  return signedDiopterString(hasPlus ? rounded : -rounded);
}

/**
 * ADD(가입도) 입력 정규화. 항상 +, +0.25 ~ +4.00 범위로 clamp, 0.25 단위.
 *   "150" → "+1.50",  "500" → "+4.00",  "10" → "+0.25"
 */
export function normalizeAddDiopter(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  const v = parseDigits(t);
  if (v === null) return '';
  let val = roundQuarter(Math.abs(v));
  val = Math.max(0.25, Math.min(4.0, val));
  return '+' + val.toFixed(2);
}

/** AXIS 입력 정규화 — 0~180 정수. */
export function normalizeAxis(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return '';
  let v = parseInt(digits, 10);
  if (!Number.isFinite(v)) return '';
  v = Math.max(0, Math.min(180, v));
  return String(v);
}
