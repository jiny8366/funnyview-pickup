import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { lenses, lensVariants } from '@/db/schema';

export interface Lifestyle {
  daysPerWeek: number | null; // 주 며칠 착용
  hoursPerDay: number | null; // 하루 몇 시간
  discomforts: string[]; // 'dryness' | 'foreign' | 'redness' | 'uv'
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
  return (v < 0 ? '-' : v > 0 ? '' : '') + v.toFixed(2);
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

  // 도수 커버 필터 — 해당 sphere 의 variant 가 있는 제품만
  const ids = rows.map((r) => r.id);
  const variantRows = await db
    .select({ lensId: lensVariants.lensId, sphere: lensVariants.sphere })
    .from(lensVariants)
    .where(and(inArray(lensVariants.lensId, ids), eq(lensVariants.isActive, true)));
  const sphereByLens = new Map<string, Set<string>>();
  for (const v of variantRows) {
    if (!sphereByLens.has(v.lensId)) sphereByLens.set(v.lensId, new Set());
    sphereByLens.get(v.lensId)!.add(v.sphere);
  }
  const targetSphere = round2(dose.sphere);
  // variant 정보가 아예 없는 제품은 도수 미상으로 통과(배제하지 않음)
  const covered = rows.filter((r) => {
    const set = sphereByLens.get(r.id);
    if (!set || set.size === 0) return true;
    return set.has(targetSphere);
  });

  const longWear = (lifestyle.hoursPerDay ?? 0) >= 8;
  const rareUse = (lifestyle.daysPerWeek ?? 7) <= 3;
  const frequentUse = (lifestyle.daysPerWeek ?? 0) >= 5;
  const d = new Set(lifestyle.discomforts);

  const scored = covered.map((r) => {
    let score = 0;
    const reasons: string[] = [];
    const silicone =
      (r.material ?? '').toLowerCase().includes('silicon') || SILICONE_HINT.test(r.name);
    const moist = MOIST_HINT.test(r.name);
    const water = r.waterContent != null ? Number(r.waterContent) : null;

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
      if (d.has('dryness') && (moist || (water != null && water >= 55))) {
        score += 3;
        reasons.push('보습');
      }
      if (d.has('redness') && ((r.oxygenDkt && r.oxygenDkt >= 100) || silicone)) {
        score += 2;
        reasons.push('산소 공급(충혈 완화)');
      }
      if (d.has('uv') && r.uvProtection) {
        score += 2;
        reasons.push('UV 차단');
      }
      if (d.has('foreign') && silicone) {
        score += 1;
        reasons.push('부드러운 착용감');
      }
    } else {
      // 두루 좋은 제품 — 물성 우수 + 신제품 가산
      if (r.oxygenDkt && r.oxygenDkt >= 100) score += 2;
      if (silicone) score += 1;
      if (moist) score += 1;
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
