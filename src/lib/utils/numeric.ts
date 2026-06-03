/**
 * numeric 컬럼 입력 정규화 — '54%', '8.6mm', ' 14.20 ' 등에서 숫자만 추출.
 * 유효 숫자가 없으면 null. (잘못된 문자열이 numeric 컬럼에 들어가 500 나는 것 방지)
 */
export function numericStr(v: unknown): string | null {
  if (v == null || v === '') return null;
  const cleaned = String(v).replace(/[^0-9.\-]/g, '').trim();
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? String(n) : null;
}
