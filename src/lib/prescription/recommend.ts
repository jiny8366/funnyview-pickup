import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { lenses, lensVariants } from '@/db/schema';

export interface Lifestyle {
  daysPerWeek: number | null; // 주 며칠 착용
  hoursPerDay: number | null; // 하루 몇 시간 (12 초과는 13)
  discomforts: string[]; // 'dryness' | 'foreign' | 'redness' | 'blur'
  features: string[]; // 원하는 기능: 'bluelight' | 'uv' | 'moisture' (생활환경과 무관하게 항상 반영)
  ignoreLifestyle: boolean; // 생활환경 무관 — 두루 좋은 제품
}

export interface RecommendDose {
  sphere: number;
  cylinder: number | null;
  addPower: number | null;
}

export interface RecommendedLens {
  id: string;
  productCode: string;
  brand: string;
  name: string;
  lensType: string;
  replacementCycle: string;
  imageUrl: string | null;
  price: number;
  score: number;
  reasons: string[];
}

/** 생년월일(YYYY-MM-DD)로 만 나이 계산. */
export function ageFromBirthDate(birth: string | null | undefined): number | null {
  if (!birth) return null;
  const b = new Date(birth);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

const SILICONE_HINT = /토탈|오아시스|울트라|에어옵틱스|에어|프리시전|토탈원|토탈30|아쿠아폼|MAX/i;
const MOIST_HINT = /워터|모이스트|아쿠아|바이오트루|하이드라|수분|컴포트|데일리스/i;

function round2(v: number): string {
  // toFixed 가 음수 부호를 이미 포함 → 별도 부호 접두 금지(과거 "--3.00" 이중부호로 추천 0개 버그).
  return v.toFixed(2);
}

/**
 * 콘택트 도수 + 생활환경으로 제품을 점수화해 추천.
 * 물성(산소투과율/UV/함수율/재질)이 입력돼 있으면 우선 활용하고,
 * 없으면 제품명 키워드로 보완한다. 도수는 variant 존재로 1차 필터한다.
 */
export async function recommendLenses(
  dose: RecommendDose,
  lifestyle: Lifestyle,
  age: number | null,
): Promise<RecommendedLens[]> {
  const needToric = dose.cylinder !== null && Math.abs(dose.cylinder) >= 0.5;
  const needMulti = dose.addPower !== null || (age != null && age >= 45);

  // 교정 타입에 맞는 렌즈 유형 후보 (컬러/서클 제외)
  const types = needToric
    ? ['toric']
    : needMulti
      ? ['multifocal', 'spherical']
      : ['spherical', 'multifocal'];

  const rows = await db
    .select({
      id: lenses.id,
      productCode: lenses.productCode,
      brand: lenses.brand,
      name: lenses.name,
      lensType: lenses.lensType,
      replacementCycle: lenses.replacementCycle,
      imageUrl: lenses.imageUrl,
      price: lenses.price,
      material: lenses.material,
      waterContent: lenses.waterContent,
      oxygenDkt: lenses.oxygenDkt,
      uvProtection: lenses.uvProtection,
      blueLight: lenses.blueLight,
      isNew: lenses.isNew,
    })
    .from(lenses)
    .where(
      and(
        eq(lenses.isActive, true),
        isNull(lenses.deletedAt),
        inArray(lenses.lensType, types as ('spherical' | 'toric' | 'multifocal')[]),
      ),
    );

  if (rows.length === 0) return [];

  // 도수 커버 필터 — 해당 sphere 의 variant 가 있는 제품만.
  // 멀티포컬은 추가로 "고객 ADD(가입도)를 적용할 수 있는 스펙" 인지까지 본다.
  const ids = rows.map((r) => r.id);
  const variantRows = await db
    .select({
      lensId: lensVariants.lensId,
      sphere: lensVariants.sphere,
      addPower: lensVariants.addPower,
    })
    .from(lensVariants)
    .where(and(inArray(lensVariants.lensId, ids), eq(lensVariants.isActive, true)));
  const sphereByLens = new Map<string, Set<string>>();
  // 제품 × (목표 sphere 에서 제공되는 가입도 ADD 목록) — 멀티포컬 ADD 매칭용
  const addAtSphereByLens = new Map<string, number[]>();
  const targetSphere = round2(dose.sphere);
  for (const v of variantRows) {
    if (!sphereByLens.has(v.lensId)) sphereByLens.set(v.lensId, new Set());
    sphereByLens.get(v.lensId)!.add(v.sphere);
    if (v.sphere === targetSphere && v.addPower != null) {
      if (!addAtSphereByLens.has(v.lensId)) addAtSphereByLens.set(v.lensId, []);
      addAtSphereByLens.get(v.lensId)!.push(Number(v.addPower));
    }
  }

  // ── 멀티포컬 ADD(가입도) 매칭 기준 (JINY 지시 — 정밀화) ─────────────────
  //
  // 국내 유통 멀티포컬은 가입도 등급이 "제품 단위"로 분리된다:
  //   · 3등급 체계(아큐브/알콘): LOW ≤ +1.25 · MID +1.50~+2.00 · HIGH +2.25~+2.50
  //   · 2등급 체계(바슈롬):     LOW +0.75~+1.50 · HIGH +1.75~+2.50
  //   · 등급 미분리(쿠퍼 프로클리어 원데이 등): 단일 디자인이 넓은 ADD 커버
  //
  // 적합 판정(비대칭): 임상 피팅은 원거리 시력 보존을 위해 "낮은 등급 우선"이 원칙.
  //   · 수치 ADD: lensAdd ∈ [rxAdd − 0.25, rxAdd + 0.50] 만 적합
  //     (예: 처방 +1.00 → LOW(+1.25) 적합 ⭕ / MID(+1.75) 부적합 ❌)
  //   · 등급 범위: rxAdd ∈ [범위min − 0.25, 범위max + 0.25] 만 적합
  //   · 동률이면 낮은 ADD 가 우선 (정렬 가산에서 처리)
  //
  // 렌즈의 ADD 파악 순서: ① variant.addPower 수치 → ② 제품명/코드의 등급 토큰
  // (HIGH/HIG/MID/MED/LOW, 코드 접미 -H/-M/-L) → ③ 둘 다 없으면 '가입도 미상'
  // (제외하지 않되 점수 가산 없이 '가입도 확인 필요' 표기로 하위 노출).
  const RX_BELOW = 0.25; // 처방보다 낮은 쪽 허용
  const RX_ABOVE = 0.5; // 처방보다 높은 쪽 허용

  type AddInfo =
    | { kind: 'numeric'; adds: number[] }
    | { kind: 'grade'; label: string; min: number; max: number }
    | { kind: 'unknown' };

  const GRADE3: Record<string, [number, number]> = {
    LOW: [0.75, 1.25],
    MID: [1.5, 2.0],
    HIGH: [2.25, 2.5],
  };
  const GRADE2: Record<string, [number, number]> = {
    LOW: [0.75, 1.5],
    HIGH: [1.75, 2.5],
  };

  function parseGrade(name: string, productCode: string): 'LOW' | 'MID' | 'HIGH' | null {
    const n = name.toUpperCase();
    if (/HIGH|HIG\b|\(H\)/.test(n) || /-H$/.test(productCode)) return 'HIGH';
    if (/MID|MED\b|\(M\)/.test(n) || /-M$/.test(productCode)) return 'MID';
    if (/LOW|\(L\)/.test(n) || /-L$/.test(productCode)) return 'LOW';
    return null;
  }

  function multifocalAddInfo(r: { id: string; name: string; productCode: string; brand: string }): AddInfo {
    const adds = addAtSphereByLens.get(r.id);
    if (adds && adds.length > 0) return { kind: 'numeric', adds: [...new Set(adds)].sort((a, b) => a - b) };
    const grade = parseGrade(r.name, r.productCode);
    if (grade) {
      // 바슈롬 = 2등급 체계 (MID 없음 — LOW 가 +1.50 까지 커버)
      const table = r.brand.includes('바슈롬') ? GRADE2 : GRADE3;
      const range = table[grade] ?? GRADE3[grade];
      if (range) return { kind: 'grade', label: grade, min: range[0], max: range[1] };
    }
    return { kind: 'unknown' };
  }

  function multifocalFitsAdd(info: AddInfo, rxAdd: number): boolean {
    if (info.kind === 'numeric') {
      return info.adds.some((a) => a >= rxAdd - RX_BELOW && a <= rxAdd + RX_ABOVE);
    }
    if (info.kind === 'grade') {
      return rxAdd >= info.min - RX_BELOW && rxAdd <= info.max + RX_ABOVE;
    }
    return true; // 미상 — 제외 대신 하위 노출 ('가입도 확인 필요')
  }

  // variant 정보가 아예 없는 제품은 도수 미상으로 통과(배제하지 않음).
  const covered = rows.filter((r) => {
    const set = sphereByLens.get(r.id);
    if (!set || set.size === 0) return true; // 도수 데이터 미상 → 통과
    if (!set.has(targetSphere)) return false; // 구면 미커버 → 제외
    // 멀티포컬 + 처방 ADD 있음 → 가입도 적합(수치·등급 기준) 제품만
    if (r.lensType === 'multifocal' && dose.addPower != null) {
      return multifocalFitsAdd(multifocalAddInfo(r), dose.addPower);
    }
    return true;
  });

  const longWear = (lifestyle.hoursPerDay ?? 0) >= 9;
  const rareUse = (lifestyle.daysPerWeek ?? 7) <= 3;
  const frequentUse = (lifestyle.daysPerWeek ?? 0) >= 5;
  const d = new Set(lifestyle.discomforts);
  const f = new Set(lifestyle.features);

  const scored = covered.map((r) => {
    let score = 0;
    const reasons: string[] = [];
    const silicone =
      (r.material ?? '').toLowerCase().includes('silicon') || SILICONE_HINT.test(r.name);
    const moist = MOIST_HINT.test(r.name);
    const water = r.waterContent != null ? Number(r.waterContent) : null;
    const hydrating = moist || (water != null && water >= 55);

    if (!lifestyle.ignoreLifestyle) {
      if (longWear) {
        if (r.oxygenDkt && r.oxygenDkt >= 100) {
          score += 3;
          reasons.push('고산소(장시간)');
        } else if (silicone) {
          score += 2;
          reasons.push('실리콘하이드로겔');
        }
      }
      if (rareUse && r.replacementCycle === '1day') {
        score += 2;
        reasons.push('가끔 착용에 위생적(원데이)');
      }
      if (frequentUse && r.replacementCycle !== '1day') {
        score += 1;
        reasons.push('자주 착용 시 경제적');
      }
      if (d.has('dryness') && hydrating) {
        score += 3;
        reasons.push('보습');
      }
      if (d.has('redness') && ((r.oxygenDkt && r.oxygenDkt >= 100) || silicone)) {
        score += 2;
        reasons.push('산소 공급(충혈 완화)');
      }
      if (d.has('foreign') && silicone) {
        score += 1;
        reasons.push('부드러운 착용감');
      }
      if (d.has('blur')) {
        // 흐림 — 단백질 침착·건조 영향. 원데이 + 보습 우선
        if (r.replacementCycle === '1day') {
          score += 2;
          reasons.push('침착 적은 원데이');
        }
        if (hydrating) {
          score += 1;
          reasons.push('보습(흐림 완화)');
        }
      }
    } else {
      // 두루 좋은 제품 — 물성 우수 + 신제품 가산
      if (r.oxygenDkt && r.oxygenDkt >= 100) score += 2;
      if (silicone) score += 1;
      if (moist) score += 1;
    }

    // 기능 요청 (생활환경 무관하게 항상 반영) — 제품 특성 매칭
    if (f.has('uv') && r.uvProtection) {
      score += 3;
      reasons.push('자외선 차단');
    }
    if (f.has('bluelight') && r.blueLight) {
      score += 3;
      reasons.push('블루라이트 차단');
    }
    if (f.has('moisture') && hydrating) {
      score += 3;
      reasons.push('수분감');
    }

    // 멀티포컬 우선 — 처방에 ADD(가입도)가 있으면 멀티포컬 제품을 상위로.
    // covered 단계에서 가입도 적합 제품만 남았으므로, 근접도(낮은 등급 우선)로 추가 가산.
    if (dose.addPower != null && r.lensType === 'multifocal') {
      const rxAdd = dose.addPower;
      const info = multifocalAddInfo(r);
      score += 6;
      if (info.kind === 'numeric') {
        // 적합 ADD 중 가장 가까운 것 — 동률이면 낮은 쪽 (배열이 오름차순이라 자동)
        const best = info.adds.reduce((p, c) =>
          Math.abs(c - rxAdd) < Math.abs(p - rxAdd) ? c : p,
        );
        const diff = Math.abs(best - rxAdd);
        if (diff <= 0.25) score += 3;
        else if (diff <= 0.5) score += 2;
        // 같은 점수대에서 낮은 ADD 가 위로 오도록 미세 가산
        score += Math.max(0, (2.5 - best) * 0.1);
        reasons.unshift(`멀티포컬 — 가입도 ADD +${best.toFixed(2)} (처방 +${rxAdd.toFixed(2)}에 적합)`);
      } else if (info.kind === 'grade') {
        const center = (info.min + info.max) / 2;
        const diff = Math.abs(center - rxAdd);
        if (diff <= 0.375) score += 3;
        else if (diff <= 0.625) score += 2;
        score += Math.max(0, (2.5 - center) * 0.1);
        reasons.unshift(
          `멀티포컬 ${info.label} 등급 (ADD +${info.min.toFixed(2)}~+${info.max.toFixed(2)}) — 처방 +${rxAdd.toFixed(2)} 적합`,
        );
      } else {
        // 가입도 미상 — 제외하지 않되 가산 없이 하위 노출 + 확인 안내
        score -= 2;
        reasons.unshift('멀티포컬 — 가입도 적합 여부 확인 필요');
      }
    }

    // 처방 ADD 없이 연령(45+)으로 멀티포컬 후보가 된 경우 — 첫 착용은 낮은 등급부터 (임상 원칙)
    if (dose.addPower == null && age != null && age >= 45 && r.lensType === 'multifocal') {
      const info = multifocalAddInfo(r);
      const lowFirst =
        (info.kind === 'grade' && info.label === 'LOW') ||
        (info.kind === 'numeric' && Math.min(...info.adds) <= 1.25);
      if (lowFirst) {
        score += 1;
        reasons.push('낮은 가입도(LOW) — 첫 멀티포컬에 권장');
      }
    }

    if (r.isNew) score += 0.5;

    return {
      id: r.id,
      productCode: r.productCode,
      brand: r.brand,
      name: r.name,
      lensType: r.lensType,
      replacementCycle: r.replacementCycle,
      imageUrl: r.imageUrl,
      price: r.price,
      score,
      reasons,
    };
  });

  scored.sort((a, b) => b.score - a.score || a.price - b.price);
  return scored.slice(0, 12);
}
