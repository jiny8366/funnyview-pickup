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

/**
 * 한쪽 눈의 안경 도수를 콘택트 도수로 변환.
 * 난시가 있으면 두 주경선(sphere, sphere+cyl)을 각각 보정 후 재합성한다.
 */
export function glassesToContactEye(p: EyePower): EyePower {
  const s = p.sphere;
  const c = p.cylinder ?? 0;
  const m1 = vertexCorrect(s); // 약주경선
  const m2 = vertexCorrect(s + c); // 강주경선
  const newSphere = roundQuarter(m1);
  const newCyl = c !== 0 ? roundQuarter(m2 - m1) : null;
  return {
    sphere: newSphere,
    cylinder: newCyl,
    axis: p.axis, // 축은 변하지 않음
    addPower: p.addPower, // 가입도(다초점)는 그대로
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
