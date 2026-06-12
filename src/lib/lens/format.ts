/**
 * 콘택트렌즈 표시명 — 계층형 (json-like) 표준 포맷.
 *
 * 통계/리포트/UI 어디서나 같은 표시 → 그루핑 일관성 확보.
 *
 * 예시:
 *   full:    ACUVUE / OASYS 1-Day / 1day / 30 / SPH -3.00
 *   full:    ACUVUE / OASYS 토릭 / 2week / 6 / SPH -3.00 / CYL -0.75 / AX 180
 *   full:    ACUVUE / OASYS 다초점 / 2week / 6 / SPH +1.50 / ADD +1.50
 *   compact: ACUVUE / OASYS 1-Day / -3.00
 *   line:    ACU-OAS1D-S-300 (SKU)
 */

/**
 * 호출 측이 API 응답(plain string) 또는 DB row(enum) 어느 쪽이든
 * 동일하게 전달할 수 있도록 string 으로 받음.
 */
export interface LensDisplayInfo {
  brand: string;
  name: string;
  replacementCycle: string;
  piecesPerBox: number;
  lensType: string;
}

export interface VariantDisplayInfo {
  sku?: string;
  sphere: string | number | null;
  cylinder: string | number | null;
  axis: number | null;
  addPower: string | number | null;
}

/**
 * 콘택트렌즈 표시 라벨 — 단일 표준 소스 (전 화면·DB 공통).
 * 업계 표준 표기(제조/유통사·질병관리청·렌즈협회 공통): 제품 마스터 기준.
 *   렌즈타입: 구면 / 토릭 / 멀티포컬 / 컬러 / 써클
 *   교체주기: 원데이 / 2주 / 1개월 / 3개월 / 6개월 / 1년
 * 어느 화면도 라벨을 재정의하지 말고 여기서 import 할 것 (드리프트 방지).
 */
export const CYCLE_LABEL: Record<string, string> = {
  '1day': '원데이',
  '2week': '2주',
  '1month': '1개월',
  '3month': '3개월',
  '6month': '6개월',
  '1year': '1년',
  // 레거시 코드 별칭(과거 데이터 호환) — 표준 표기로 매핑
  daily: '원데이',
  biweekly: '2주',
  monthly: '1개월',
  quarterly: '3개월',
  yearly: '1년',
};

export const LENS_TYPE_LABEL: Record<string, string> = {
  spherical: '구면',
  toric: '토릭',
  multifocal: '멀티포컬',
  color: '컬러',
  circle: '써클',
};

/** 코드 → 표준 라벨 (없으면 코드 그대로). */
export const cycleLabel = (v: string): string => CYCLE_LABEL[v] ?? v;
export const lensTypeLabel = (v: string): string => LENS_TYPE_LABEL[v] ?? v;

/**
 * 도수값 (numeric 컬럼) → 표시 문자열.
 *   -3.00 → "-3.00"
 *   +1.5  → "+1.50"
 *   null  → null
 */
export function formatPower(v: string | number | null | undefined): string | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'string' ? Number(v) : v;
  if (!Number.isFinite(n)) return null;
  const sign = n >= 0 ? '+' : '-';
  return `${sign}${Math.abs(n).toFixed(2)}`;
}

export function formatAxis(axis: number | null | undefined): string | null {
  if (axis == null) return null;
  return String(axis).padStart(3, '0');
}

export interface FormatOptions {
  /** 'full' 계층 전체 / 'compact' 핵심만 / 'spec' 도수만 / 'sku' SKU 코드 */
  format?: 'full' | 'compact' | 'spec' | 'sku';
  /** 구분자 (기본 ' / ') */
  separator?: string;
  /** lensType 라벨 포함 (full 일 때 기본 false — name 에 보통 포함되므로) */
  includeLensType?: boolean;
}

/**
 * 표시명 — 계층형 슬래시 구분.
 */
export function formatLensDisplayName(
  lens: LensDisplayInfo,
  variant: VariantDisplayInfo,
  opts: FormatOptions = {},
): string {
  const sep = opts.separator ?? ' / ';
  const format = opts.format ?? 'full';

  if (format === 'sku') return variant.sku ?? '';

  const spec = formatLensSpec(variant);

  if (format === 'spec') return spec;

  if (format === 'compact') {
    return [lens.brand, lens.name, spec].filter(Boolean).join(sep);
  }

  // full
  const parts: string[] = [
    lens.brand,
    lens.name,
    CYCLE_LABEL[lens.replacementCycle] ?? lens.replacementCycle,
    `${lens.piecesPerBox}매`,
  ];
  if (opts.includeLensType) {
    parts.push(LENS_TYPE_LABEL[lens.lensType] ?? lens.lensType);
  }
  if (spec) parts.push(spec);
  return parts.join(sep);
}

/**
 * 도수 스펙만 — "SPH -3.00 / CYL -0.75 / AX 180 / ADD +1.50"
 */
export function formatLensSpec(
  variant: Omit<VariantDisplayInfo, 'sku'>,
  separator = ' / ',
): string {
  const parts: string[] = [];
  const sph = formatPower(variant.sphere);
  if (sph) parts.push(`SPH ${sph}`);

  const cyl = formatPower(variant.cylinder);
  if (cyl && variant.cylinder != null && Number(variant.cylinder) !== 0) {
    parts.push(`CYL ${cyl}`);
    const ax = formatAxis(variant.axis);
    if (ax) parts.push(`AX ${ax}`);
  }

  const add = formatPower(variant.addPower);
  if (add && variant.addPower != null && Number(variant.addPower) !== 0) {
    parts.push(`ADD ${add}`);
  }

  return parts.join(separator);
}

/**
 * 통계 그루핑 키 — 일관된 집계용.
 *   'brand'        → 'ACUVUE'
 *   'product'      → 'ACUVUE/ACU-OAS1D'
 *   'cycle'        → 'ACUVUE/ACU-OAS1D/1day'
 *   'pack'         → 'ACUVUE/ACU-OAS1D/30'
 *   'sphRange'     → 'ACUVUE/ACU-OAS1D/-3.00~-5.00'
 */
export function lensGroupingKey(
  lens: {
    brand: string;
    productCode: string;
    replacementCycle: string;
    piecesPerBox: number;
  },
  variant: { sphere: string | number | null } | null,
  axis: 'brand' | 'product' | 'cycle' | 'pack' | 'sphRange',
): string {
  switch (axis) {
    case 'brand':
      return lens.brand;
    case 'product':
      return `${lens.brand}/${lens.productCode}`;
    case 'cycle':
      return `${lens.brand}/${lens.productCode}/${lens.replacementCycle}`;
    case 'pack':
      return `${lens.brand}/${lens.productCode}/${lens.piecesPerBox}`;
    case 'sphRange': {
      const sph = variant ? Number(variant.sphere) : 0;
      const range = sphRangeBucket(sph);
      return `${lens.brand}/${lens.productCode}/${range}`;
    }
  }
}

function sphRangeBucket(sph: number): string {
  // 일반적 임상 도수대 분할
  if (sph >= 0) {
    if (sph <= 1) return '0.00~+1.00';
    if (sph <= 3) return '+1.25~+3.00';
    return '+3.25~+6.00';
  }
  const abs = Math.abs(sph);
  if (abs <= 1) return '0.00~-1.00';
  if (abs <= 3) return '-1.25~-3.00';
  if (abs <= 5) return '-3.25~-5.00';
  if (abs <= 7) return '-5.25~-7.00';
  return '-7.25~-12.00';
}

/**
 * 매수 환산 — "12팩 (360매)"
 */
export function formatPackQuantity(packs: number, piecesPerBox: number): string {
  return `${packs.toLocaleString()}팩 (${(packs * piecesPerBox).toLocaleString()}매)`;
}
