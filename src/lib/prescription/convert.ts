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

/** 도수 숫자를 처방 표기 문자열로 (+0.00 / -3.75). */
export function formatDiopter(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${sign}${Math.abs(v).toFixed(2)}`;
}
