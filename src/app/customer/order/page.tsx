'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PrescriptionManager } from '@/components/prescription/prescription-manager';
import { formatKRW } from '@/lib/utils/format';
import { powerVector, dioptricDistance } from '@/lib/prescription/convert';

interface LensVariant {
  variantId: string;
  sku: string;
  sphere: string;
  cylinder: string | null;
  axis: number | null;
  addPower: string | null;
  price: number;
  available: number;
}

interface EyeData {
  sphere: string;
  cylinder: string | null;
  axis: number | null;
  addPower: string | null;
}

interface PrescriptionGroup {
  recordedAt: string;
  kind: 'glasses' | 'contact';
  source: string | null;
  left: EyeData | null;
  right: EyeData | null;
}

interface Lens {
  lensId: string;
  productCode: string;
  brand: string;
  name: string;
  lensType: string;
  replacementCycle: string;
  piecesPerBox: number;
  price: number;
  imageUrl: string | null;
  colorName: string | null;
  colorHex: string | null;
  isNew: boolean;
  variants: LensVariant[];
}

interface Store {
  id: string;
  code: string;
  name: string;
  phone: string;
  address: string;
}

const REGION_GROUPS = [
  { key: '서울', match: ['서울'] },
  { key: '경기', match: ['경기'] },
  { key: '인천', match: ['인천'] },
  { key: '부산', match: ['부산'] },
  { key: '대구', match: ['대구'] },
  { key: '대전', match: ['대전'] },
  { key: '광주', match: ['광주'] },
  { key: '울산', match: ['울산'] },
  { key: '세종', match: ['세종'] },
  { key: '강원', match: ['강원'] },
  { key: '충북', match: ['충북', '충청북'] },
  { key: '충남', match: ['충남', '충청남'] },
  { key: '전북', match: ['전북', '전라북'] },
  { key: '전남', match: ['전남', '전라남'] },
  { key: '경북', match: ['경북', '경상북'] },
  { key: '경남', match: ['경남', '경상남'] },
  { key: '제주', match: ['제주'] },
] as const;

function regionOf(address: string): string | null {
  const a = address?.trim() ?? '';
  if (!a) return null;
  for (const g of REGION_GROUPS) {
    if (g.match.some((m) => a.startsWith(m))) return g.key;
  }
  return null;
}

type EyeSide = 'left' | 'right';

/** 주문 대상 — 양안 / 우안만 / 좌안만 (라디오) */
type EyeMode = 'both' | 'right-only' | 'left-only';

type TypeKey = 'all' | 'color' | '1day' | 'extended' | 'toric' | 'multifocal';

const TYPE_TABS: { key: TypeKey; label: string }[] = [
  { key: 'all',        label: '전체' },
  { key: 'color',      label: '컬러렌즈' },
  { key: '1day',       label: '원데이' },
  { key: 'extended',   label: '장기착용' },
  { key: 'toric',      label: '난시용' },
  { key: 'multifocal', label: '다초점' },
];

function isColored(l: Lens) {
  return l.lensType === 'color' || l.lensType === 'circle';
}

function matchesType(l: Lens, key: TypeKey) {
  if (key === 'all') return true;
  if (key === 'color') return isColored(l);
  if (key === '1day') return l.replacementCycle === '1day' && !isColored(l);
  // 장기착용 = 교착주기 필터 — 원데이가 아닌 모든(구면/난시용/다초점) 비컬러 렌즈 포함
  if (key === 'extended') return l.replacementCycle !== '1day' && !isColored(l);
  if (key === 'toric') return l.lensType === 'toric';
  if (key === 'multifocal') return l.lensType === 'multifocal';
  return true;
}

type MatchMethod = 'exact' | 'se';

/** 추천 조합의 우선순위 단계.
 *  same-exact: 양안 동일 제품(정확) / same-se: 양안 동일 제품(구면등가 변환) /
 *  brand-line: 같은 브랜드·같은 라인(난시용+구면) / brand: 같은 브랜드(제품 매칭). */
type PairTier = 'same-exact' | 'same-se' | 'brand-line' | 'brand';

const TIER_RANK: Record<PairTier, number> = {
  'same-exact': 0,
  'same-se': 1,
  'brand-line': 2,
  brand: 3,
};

const TIER_LABEL: Record<PairTier, string> = {
  'same-exact': '양안 동일 제품',
  'same-se': '양안 동일 제품 · 구면등가',
  'brand-line': '같은 브랜드 · 같은 라인',
  brand: '같은 브랜드',
};

interface EyePick {
  lens: Lens;
  variant: LensVariant;
  method: MatchMethod;
}

interface PairRec {
  key: string;
  tier: PairTier;
  right: EyePick;
  left: EyePick;
  /** 양안이 같은 제품(lens)인가. */
  sameProduct: boolean;
  /** 양안이 같은 브랜드인가. */
  sameBrand: boolean;
  /** 양안 모두 재고 보유. */
  inStock: boolean;
  /** 1박스 기준 합계(우+좌). */
  total: number;
}

interface LensEligibility {
  /** 모든 필요 눈에 (exact || SE) 매칭이 존재 (재고 무관). 구면등가 토글이 켜졌을 때 적용. */
  doseMatch: boolean;
  /** 모든 필요 눈에 exact 매칭 — SE 도움 없이도 가능. */
  doseMatchExact: boolean;
  /** 매칭 variant 들이 모두 재고가 있음 (주문 가능). */
  inStock: boolean;
  leftVariant: LensVariant | null;
  rightVariant: LensVariant | null;
  /** 각 눈의 매칭 방식 ('exact' = 정확, 'se' = 구면등가 변환). */
  leftMethod: MatchMethod | null;
  rightMethod: MatchMethod | null;
  reasons: string[];
}

export default function CustomerOrderPage() {
  const router = useRouter();
  const [lenses, setLenses] = useState<Lens[]>([]);
  const [stores, setStores] = useState<Store[]>([]);

  // 도수 (도수정보가 모든 흐름의 출발점)
  const [savedDose, setSavedDose] = useState<{
    left: EyeData | null;
    right: EyeData | null;
    recordedAt: string | null;
  }>({ left: null, right: null, recordedAt: null });
  const [doseModalOpen, setDoseModalOpen] = useState(false);
  const [doseLoaded, setDoseLoaded] = useState(false);

  // 주문 대상 (양안 / 좌안만 / 우안만) — 도수 로드 후 자동 결정
  const [eyeMode, setEyeMode] = useState<EyeMode>('both');
  // 수량은 제품 선택 후 입력 — 기본 1박스
  const [leftQty, setLeftQty] = useState(1);
  const [rightQty, setRightQty] = useState(1);

  // 제품 선택 — 단일 제품(selectedLensId) 또는 추천 조합(pairPickKey) 중 하나
  const [selectedLensId, setSelectedLensId] = useState<string | null>(null);
  const [pairPickKey, setPairPickKey] = useState<string | null>(null);

  // 매장 / 결제
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeRegion, setStoreRegion] = useState<string | null>(null);
  const [note, setNote] = useState('');

  // 제출
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 제품 필터
  const [query, setQuery] = useState('');
  const [typeKey, setTypeKey] = useState<TypeKey>('all');
  const [brand, setBrand] = useState('');
  const [showOnlyEligible, setShowOnlyEligible] = useState(true);
  /** 난시 변형이 없을 때 구면등가(Spherical Equivalent) 변환 도수도 후보로 포함. */
  const [includeSEFallback, setIncludeSEFallback] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/lenses').then((r) => r.json()),
      fetch('/api/stores').then((r) => r.json()),
    ])
      .then(([lensData, storeData]) => {
        setLenses(lensData.lenses ?? []);
        setStores(storeData.stores ?? []);
      })
      .catch(() => setError('데이터를 불러오지 못했습니다'));
  }, []);

  const loadSavedDose = useCallback(async () => {
    try {
      const res = await fetch('/api/customer/prescriptions');
      if (!res.ok) {
        setDoseLoaded(true);
        return;
      }
      const j = await res.json();
      const groups = (j.prescriptions ?? []) as PrescriptionGroup[];
      // 좌·우 도수를 다른 시점에 따로 저장하면 서로 다른 그룹이 된다.
      // 최신 그룹 1개만 보면 한쪽 눈이 비어 주문 대상이 한쪽으로 강제되므로,
      // 좌·우 각각 가장 최근 값을 독립적으로 취한다. (groups 는 recordedAt 내림차순)
      const contactGroups = groups.filter((g) => g.kind === 'contact');
      const latestLeft = contactGroups.find((g) => g.left)?.left ?? null;
      const latestRight = contactGroups.find((g) => g.right)?.right ?? null;
      if (latestLeft || latestRight) {
        setSavedDose({
          left: latestLeft,
          right: latestRight,
          recordedAt: contactGroups[0]?.recordedAt ?? null,
        });
      }
    } catch {
      /* ignore */
    } finally {
      setDoseLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadSavedDose();
  }, [loadSavedDose]);

  // 도수 + 주문 대상 모드(eyeMode) 로부터 "필요 도수" 도출
  const needLeft =
    !!savedDose.left && (eyeMode === 'both' || eyeMode === 'left-only');
  const needRight =
    !!savedDose.right && (eyeMode === 'both' || eyeMode === 'right-only');
  const hasDoseToOrder = needLeft || needRight;

  // 도수 로드 후 eyeMode 자동 초기화 — 양안 도수 모두 있으면 양안, 아니면 가능한 쪽
  useEffect(() => {
    if (!doseLoaded) return;
    if (savedDose.left && savedDose.right) setEyeMode('both');
    else if (savedDose.right) setEyeMode('right-only');
    else if (savedDose.left) setEyeMode('left-only');
  }, [doseLoaded, savedDose.left, savedDose.right]);

  // 제품별 적합성 계산 — 도수 매칭과 재고를 분리하여 사용자에게 원인 노출
  const eligibilityByLens = useMemo(() => {
    const map = new Map<string, LensEligibility>();
    for (const l of lenses) {
      const leftMatch =
        needLeft && savedDose.left
          ? matchEye(l.variants, savedDose.left, includeSEFallback)
          : null;
      const rightMatch =
        needRight && savedDose.right
          ? matchEye(l.variants, savedDose.right, includeSEFallback)
          : null;
      const leftMatchExact =
        needLeft && savedDose.left ? matchVariant(l.variants, savedDose.left) : null;
      const rightMatchExact =
        needRight && savedDose.right
          ? matchVariant(l.variants, savedDose.right)
          : null;
      const doseMatch =
        (!needLeft || !!leftMatch) && (!needRight || !!rightMatch);
      const doseMatchExact =
        (!needLeft || !!leftMatchExact) && (!needRight || !!rightMatchExact);
      const leftVariant = leftMatch?.variant ?? null;
      const rightVariant = rightMatch?.variant ?? null;
      const inStock =
        doseMatch &&
        (!leftVariant || leftVariant.available > 0) &&
        (!rightVariant || rightVariant.available > 0);
      const reasons: string[] = [];
      if (needLeft && !leftMatch) reasons.push('좌안 도수 미지원');
      if (needRight && !rightMatch) reasons.push('우안 도수 미지원');
      if (doseMatch && !inStock) reasons.push('재고 없음');
      map.set(l.lensId, {
        doseMatch,
        doseMatchExact,
        inStock,
        leftVariant,
        rightVariant,
        leftMethod: leftMatch?.method ?? null,
        rightMethod: rightMatch?.method ?? null,
        reasons,
      });
    }
    return map;
  }, [lenses, savedDose, needLeft, needRight, includeSEFallback]);

  const selectedLens = useMemo(
    () => lenses.find((l) => l.lensId === selectedLensId) ?? null,
    [lenses, selectedLensId],
  );
  const selectedElig = selectedLens
    ? eligibilityByLens.get(selectedLens.lensId) ?? null
    : null;

  // 선택한 제품이 도수 변경으로 도수 미지원이 되면 해제 (재고만 없는 경우는 유지)
  useEffect(() => {
    if (selectedLens && selectedElig && !selectedElig.doseMatch) {
      setSelectedLensId(null);
    }
  }, [selectedLens, selectedElig]);

  // 추천 조합 — 양안 모드 + 좌·우 도수 모두 있을 때, 우선순위별 좌·우 페어.
  // 선택한 카테고리(원데이/장기착용 등)로 후보를 한정해 같은 교착주기 안에서 묶는다
  // (예: 원데이 → 원데이 구면 + 원데이 난시용/다초점).
  const pairRecs = useMemo(() => {
    if (eyeMode !== 'both' || !needLeft || !needRight) return [];
    if (!savedDose.left || !savedDose.right) return [];
    const pool = lenses.filter((l) => matchesType(l, typeKey));
    return buildPairRecs(pool, savedDose.right, savedDose.left);
  }, [lenses, typeKey, eyeMode, needLeft, needRight, savedDose.left, savedDose.right]);

  const resolvedPair = useMemo(
    () => pairRecs.find((r) => r.key === pairPickKey) ?? null,
    [pairRecs, pairPickKey],
  );

  // 양안 모드를 벗어나면 추천 조합 선택 해제
  useEffect(() => {
    if (eyeMode !== 'both' && pairPickKey) setPairPickKey(null);
  }, [eyeMode, pairPickKey]);

  // 통합 선택 — 추천 조합(pairPick) 우선, 없으면 단일 제품(selectedLens)
  const resolved = useMemo<{
    right: EyePick | null;
    left: EyePick | null;
    isPair: boolean;
  } | null>(() => {
    if (resolvedPair) {
      return {
        right: needRight ? resolvedPair.right : null,
        left: needLeft ? resolvedPair.left : null,
        isPair: true,
      };
    }
    if (selectedLens && selectedElig && selectedElig.doseMatch) {
      return {
        right: selectedElig.rightVariant
          ? {
              lens: selectedLens,
              variant: selectedElig.rightVariant,
              method: selectedElig.rightMethod ?? 'exact',
            }
          : null,
        left: selectedElig.leftVariant
          ? {
              lens: selectedLens,
              variant: selectedElig.leftVariant,
              method: selectedElig.leftMethod ?? 'exact',
            }
          : null,
        isPair: false,
      };
    }
    return null;
  }, [resolvedPair, selectedLens, selectedElig, needRight, needLeft]);

  const resolvedInStock =
    !!resolved &&
    (!resolved.right || resolved.right.variant.available > 0) &&
    (!resolved.left || resolved.left.variant.available > 0);

  /** 양안이 같은 제품인가 (요약 표시 분기용). */
  const resolvedSameLens =
    !resolved ||
    !resolved.right ||
    !resolved.left ||
    resolved.right.lens.lensId === resolved.left.lens.lensId;

  const brands = useMemo(
    () => [...new Set(lenses.map((l) => l.brand))].sort(),
    [lenses],
  );

  const filteredLenses = useMemo(() => {
    let list = lenses;
    if (brand) list = list.filter((l) => l.brand === brand);
    list = list.filter((l) => matchesType(l, typeKey));
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.brand.toLowerCase().includes(q),
      );
    }
    if (hasDoseToOrder) {
      if (showOnlyEligible) {
        // 토글 ON: 도수 매칭 제품만 (재고 없는 것도 포함 — 사유 노출)
        list = list.filter(
          (l) => eligibilityByLens.get(l.lensId)?.doseMatch ?? false,
        );
      }
      // 정렬: 재고 있는 것 > 도수만 매칭 > 도수 미지원
      list = [...list].sort((a, b) => {
        const ea = eligibilityByLens.get(a.lensId);
        const eb = eligibilityByLens.get(b.lensId);
        const sa = ea?.inStock ? 0 : ea?.doseMatch ? 1 : 2;
        const sb = eb?.inStock ? 0 : eb?.doseMatch ? 1 : 2;
        return sa - sb;
      });
    }
    return list;
  }, [
    lenses,
    brand,
    typeKey,
    query,
    showOnlyEligible,
    hasDoseToOrder,
    eligibilityByLens,
  ]);

  /** 도수 매칭 + 재고 있는 제품 수 (실제 주문 가능). */
  const inStockCount = useMemo(
    () =>
      hasDoseToOrder
        ? lenses.filter((l) => eligibilityByLens.get(l.lensId)?.inStock).length
        : lenses.length,
    [lenses, eligibilityByLens, hasDoseToOrder],
  );

  /** 도수 매칭 제품 수 (재고 무관). */
  const doseMatchCount = useMemo(
    () =>
      hasDoseToOrder
        ? lenses.filter((l) => eligibilityByLens.get(l.lensId)?.doseMatch).length
        : lenses.length,
    [lenses, eligibilityByLens, hasDoseToOrder],
  );

  /** 정확 매칭 (구면등가 미사용) 제품 수. */
  const exactMatchCount = useMemo(
    () =>
      hasDoseToOrder
        ? lenses.filter((l) => eligibilityByLens.get(l.lensId)?.doseMatchExact).length
        : lenses.length,
    [lenses, eligibilityByLens, hasDoseToOrder],
  );

  /** SE 변환만으로 추가된 제품 수 (정확 매칭에 없는 것). */
  const seOnlyCount = doseMatchCount - exactMatchCount;

  /** 난시가 있는 눈 (양안 모드 + 한쪽이라도 CYL>0). 구면등가 토글 의미가 있는지 판단용. */
  const hasAstigmaticEye = useMemo(() => {
    return (
      (needLeft && !!savedDose.left && isAstigmatic(savedDose.left.cylinder)) ||
      (needRight && !!savedDose.right && isAstigmatic(savedDose.right.cylinder))
    );
  }, [savedDose, needLeft, needRight]);

  /** 난시 눈의 구면등가 변환 결과 표시용 (SPH -3.00 등). */
  const seSummary = useMemo(() => {
    const result: { side: '좌' | '우'; original: string; se: string }[] = [];
    // 표시 순서는 우안 먼저
    if (needRight && savedDose.right) {
      const se = sphericalEquivalent(savedDose.right);
      if (se) result.push({ side: '우', original: eyeSummary(savedDose.right), se: se.sphere });
    }
    if (needLeft && savedDose.left) {
      const se = sphericalEquivalent(savedDose.left);
      if (se) result.push({ side: '좌', original: eyeSummary(savedDose.left), se: se.sphere });
    }
    return result;
  }, [savedDose, needLeft, needRight]);

  /** 브랜드별 도수 매칭 / 재고 있는 제품 수. */
  const countsByBrand = useMemo(() => {
    const map = new Map<string, { doseMatch: number; inStock: number }>();
    for (const l of lenses) {
      const cur = map.get(l.brand) ?? { doseMatch: 0, inStock: 0 };
      if (hasDoseToOrder) {
        const e = eligibilityByLens.get(l.lensId);
        if (e?.doseMatch) cur.doseMatch += 1;
        if (e?.inStock) cur.inStock += 1;
      } else {
        cur.doseMatch += 1;
        cur.inStock += 1;
      }
      map.set(l.brand, cur);
    }
    return map;
  }, [lenses, eligibilityByLens, hasDoseToOrder]);

  const hasFilter = Boolean(brand || typeKey !== 'all' || query.trim());

  const total = useMemo(() => {
    if (!resolved) return 0;
    let sum = 0;
    if (resolved.right) sum += resolved.right.variant.price * rightQty;
    if (resolved.left) sum += resolved.left.variant.price * leftQty;
    return sum;
  }, [resolved, leftQty, rightQty]);

  const canSubmit =
    !!resolved &&
    resolvedInStock &&
    !!storeId &&
    hasDoseToOrder &&
    !submitting;

  // 버튼 비활성 사유 안내 (M3 E2E 확정 — 왜 못 누르는지 표시). 흐름 순서대로 가장 먼저 빠진 단계.
  const disabledReason = useMemo(() => {
    if (!hasDoseToOrder) return '도수를 입력하고 제품을 선택하세요';
    if (!resolved) return '제품(도수)을 선택하세요';
    if (!resolvedInStock) return '선택한 도수의 재고가 부족합니다';
    if (!storeId) return '픽업가맹점을 선택하세요';
    return null;
  }, [hasDoseToOrder, resolved, resolvedInStock, storeId]);

  async function onSubmit() {
    if (!canSubmit || !resolved) return;
    setSubmitting(true);
    setError(null);
    // 라인 순서는 우안 먼저
    const lines: Array<{ variantId: string; eyeSide: EyeSide; quantity: number }> = [];
    if (resolved.right) {
      lines.push({
        variantId: resolved.right.variant.variantId,
        eyeSide: 'right',
        quantity: rightQty,
      });
    }
    if (resolved.left) {
      lines.push({
        variantId: resolved.left.variant.variantId,
        eyeSide: 'left',
        quantity: leftQty,
      });
    }

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        pickupStoreId: storeId,
        customerNote: note || undefined,
        lines,
        payOnline: false,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.message ?? '주문 생성 실패');
      return;
    }
    const data = await res.json();
    router.replace(`/customer/orders/${data.orderId}`);
  }

  return (
    <div className="animate-fade-in space-y-6 pb-32 md:space-y-8 md:pb-0">
      <header>
        <h1 className="text-xl font-bold md:text-2xl">주문하기</h1>
        <p className="mt-1 text-sm text-gray-500">
          도수 확인 → 제품 선택 → 픽업가맹점 → 결제
        </p>
      </header>

      {/* 1. 도수 정보 — 모든 흐름의 출발점 */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-gray-700">1. 내 도수 정보</h2>
          <button
            type="button"
            onClick={() => setDoseModalOpen(true)}
            className="text-xs font-medium text-brand-700 underline hover:text-brand-800"
          >
            {savedDose.left || savedDose.right ? '수정/관리' : '등록하기'}
          </button>
        </div>

        {!doseLoaded ? (
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-400">
            불러오는 중...
          </div>
        ) : !savedDose.left && !savedDose.right ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="text-sm font-semibold text-amber-800">
              등록된 콘택트 도수가 없습니다.
            </div>
            <p className="mt-1 text-xs text-amber-700">
              제품 선택을 위해 먼저 좌·우 도수를 등록해 주세요.
            </p>
            <button
              type="button"
              onClick={() => setDoseModalOpen(true)}
              className="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-amber-700"
            >
              도수 등록하기 →
            </button>
          </div>
        ) : (
          <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4">
            {savedDose.recordedAt && (
              <p className="text-[10px] text-gray-400">
                기준일: {new Date(savedDose.recordedAt).toLocaleDateString('ko-KR')}
              </p>
            )}
            {/* 모바일: 우(상) / 좌(하) 세로. 데스크탑: 우(좌) / 좌(우) 한 줄. */}
            <div className="grid gap-2 md:grid-cols-2">
              <EyeChip label="우 (R, OD)" dose={savedDose.right} />
              <EyeChip label="좌 (L, OS)" dose={savedDose.left} />
            </div>
          </div>
        )}
      </section>

      {/* 2. 상품 선택 — 도수 적합성 기반 */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-700">2. 상품 선택</h2>
          {lenses.length > 0 && hasDoseToOrder && (
            <label className="flex items-center gap-1.5 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={showOnlyEligible}
                onChange={(e) => setShowOnlyEligible(e.target.checked)}
                className="h-3.5 w-3.5 rounded"
              />
              내 도수 가능 제품만
            </label>
          )}
        </div>

        {/* 주문 대상 라디오 (양안 / 우안만 / 좌안만) */}
        {(savedDose.left || savedDose.right) && (
          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5">
            <div className="mb-1.5 text-[11px] font-semibold text-gray-700">
              주문 대상
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              <EyeModeRadio
                value="both"
                current={eyeMode}
                onChange={setEyeMode}
                disabled={!savedDose.left || !savedDose.right}
                label="양안"
              />
              <EyeModeRadio
                value="right-only"
                current={eyeMode}
                onChange={setEyeMode}
                disabled={!savedDose.right}
                label="우안만"
              />
              <EyeModeRadio
                value="left-only"
                current={eyeMode}
                onChange={setEyeMode}
                disabled={!savedDose.left}
                label="좌안만"
              />
            </div>
          </div>
        )}

        {/* 양안 매칭 0종 경고 — 좌·우 각각 주문 권장 */}
        {eyeMode === 'both' && hasDoseToOrder && lenses.length > 0 && doseMatchCount === 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3">
            <div className="text-sm font-semibold text-red-700">
              양안 모두 충족하는 제품이 없습니다.
            </div>
            <p className="mt-1 text-xs text-red-600">
              좌·우 렌즈를 각각 선택해 주십시오.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setEyeMode('right-only')}
                disabled={!savedDose.right}
                className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-40"
              >
                먼저 우안 선택
              </button>
              <button
                type="button"
                onClick={() => setEyeMode('left-only')}
                disabled={!savedDose.left}
                className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-40"
              >
                먼저 좌안 선택
              </button>
            </div>
          </div>
        )}

        {!hasDoseToOrder ? (
          <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
            먼저 도수를 등록하고 주문 대상을 선택해 주세요.
          </div>
        ) : (
          <>
            {/* 선택 요약 + 수량 입력 — 단일 제품 또는 추천 조합(양안 다른 제품) */}
            {resolved && (() => {
              const headLens = resolved.right?.lens ?? resolved.left?.lens ?? null;
              return (
                <div className="space-y-2 rounded-2xl border-2 border-brand-600 bg-brand-50 p-3">
                  <div className="flex items-center gap-3">
                    {resolvedSameLens && headLens ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={headLens.imageUrl ?? `/api/lens-image/${headLens.productCode}`}
                          alt={headLens.name}
                          className="h-14 w-14 shrink-0 rounded-lg bg-white object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[10px] font-medium uppercase tracking-wider text-brand-700">
                            {headLens.brand} · 선택됨
                          </p>
                          <p className="truncate text-sm font-semibold text-gray-900">
                            {headLens.name}
                          </p>
                          <p className="text-[11px] text-gray-500">
                            {headLens.replacementCycle} · {headLens.piecesPerBox}매
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-brand-700">
                          추천 조합 · 선택됨
                        </p>
                        <p className="text-sm font-semibold text-gray-900">
                          좌·우 다른 제품{headLens ? ` · ${headLens.brand}` : ''}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          한쪽 난시로 눈마다 최적 제품을 매칭했습니다.
                        </p>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLensId(null);
                        setPairPickKey(null);
                      }}
                      className="shrink-0 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-400"
                    >
                      변경
                    </button>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    {resolved.right && (
                      <VariantQtyRow
                        side="우 (R)"
                        product={resolvedSameLens ? undefined : `${resolved.right.lens.brand} ${resolved.right.lens.name}`}
                        variant={resolved.right.variant}
                        qty={rightQty}
                        onQtyChange={setRightQty}
                        method={resolved.right.method}
                      />
                    )}
                    {resolved.left && (
                      <VariantQtyRow
                        side="좌 (L)"
                        product={resolvedSameLens ? undefined : `${resolved.left.lens.brand} ${resolved.left.lens.name}`}
                        variant={resolved.left.variant}
                        qty={leftQty}
                        onQtyChange={setLeftQty}
                        method={resolved.left.method}
                      />
                    )}
                    {!resolvedInStock && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                        도수는 맞지만 재고가 입고 대기 중입니다 — 주문 불가.
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* 브랜드 선택 — 1차 필터 (도수 다음 단계) */}
            {brands.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <label className="text-[11px] font-semibold text-gray-700">
                    브랜드 선택
                    {hasDoseToOrder && (
                      <span className="ml-1 font-normal text-[10px] text-gray-400">
                        (괄호: 재고 가능 / 도수 가능)
                      </span>
                    )}
                  </label>
                  {brand && (
                    <button
                      type="button"
                      onClick={() => setBrand('')}
                      className="text-[10px] text-gray-400 hover:text-gray-700"
                    >
                      ✕ 전체 브랜드
                    </button>
                  )}
                </div>
                <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1">
                  <button
                    type="button"
                    onClick={() => setBrand('')}
                    className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                      brand === ''
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    전체{' '}
                    <span className={brand === '' ? 'text-white/70' : 'text-gray-400'}>
                      ({hasDoseToOrder ? `${inStockCount}/${doseMatchCount}` : doseMatchCount})
                    </span>
                  </button>
                  {brands.map((b) => {
                    const c = countsByBrand.get(b) ?? { doseMatch: 0, inStock: 0 };
                    const dim = hasDoseToOrder && c.doseMatch === 0;
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setBrand(brand === b ? '' : b)}
                        className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                          brand === b
                            ? 'border-gray-900 bg-gray-900 text-white'
                            : dim
                              ? 'border-gray-200 bg-gray-50 text-gray-400'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                        }`}
                      >
                        {b}{' '}
                        <span
                          className={
                            brand === b
                              ? 'text-white/70'
                              : dim
                                ? 'text-gray-300'
                                : 'text-brand-600'
                          }
                        >
                          ({hasDoseToOrder ? `${c.inStock}/${c.doseMatch}` : c.doseMatch})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 선택된 브랜드 — 도수 매칭 결과 헤더 */}
            {brand && (
              <div className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2.5">
                <p className="text-xs text-gray-700">
                  <strong className="text-brand-700">{brand}</strong>
                  {hasDoseToOrder ? (
                    <>
                      {' '}브랜드: 도수 가능{' '}
                      <strong className="text-brand-700">
                        {countsByBrand.get(brand)?.doseMatch ?? 0}종
                      </strong>{' '}
                      · 즉시 주문{' '}
                      <strong className="text-emerald-700">
                        {countsByBrand.get(brand)?.inStock ?? 0}종
                      </strong>
                    </>
                  ) : (
                    <>
                      {' '}브랜드 전체 제품{' '}
                      <strong className="text-brand-700">
                        {countsByBrand.get(brand)?.doseMatch ?? 0}종
                      </strong>
                    </>
                  )}
                </p>
              </div>
            )}

            {/* 💡 도수 매칭 가이드 — 난시 / 구면등가 / 카테고리 추천 */}
            {hasDoseToOrder && hasAstigmaticEye && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 space-y-2">
                <div className="flex items-baseline justify-between">
                  <div className="text-xs font-semibold text-amber-900">
                    💡 도수 매칭 가이드
                  </div>
                  {typeKey !== 'toric' && (
                    <button
                      type="button"
                      onClick={() => setTypeKey('toric')}
                      className="text-[10px] font-medium text-amber-800 underline hover:no-underline"
                    >
                      난시용 카테고리로 →
                    </button>
                  )}
                </div>
                <ul className="space-y-0.5 text-[11px] text-amber-900">
                  <li>
                    난시용(토릭) 매칭{' '}
                    <strong>{exactMatchCount}종</strong>
                    <span className="text-amber-700"> · 가장 가까운 CYL/축으로 근사</span>
                  </li>
                  {seSummary.map((s) => (
                    <li key={s.side}>
                      {s.side}안 구면등가 ≈ <strong>SPH {s.se}</strong> (원: {s.original})
                    </li>
                  ))}
                </ul>
                <label className="flex items-center gap-1.5 rounded-md bg-white/60 px-2 py-1.5 text-[11px]">
                  <input
                    type="checkbox"
                    checked={includeSEFallback}
                    onChange={(e) => setIncludeSEFallback(e.target.checked)}
                    className="h-3.5 w-3.5"
                  />
                  <span>
                    구면등가 변환 제품도 포함{' '}
                    {seOnlyCount > 0 && (
                      <span className="text-amber-700">(+{seOnlyCount}종 추가)</span>
                    )}
                  </span>
                </label>
                <p className="text-[10px] text-amber-700">
                  ⓘ 구면등가는 |CYL|≤0.75 의 약한 난시에서 일반 렌즈로 간이 보정하는 방법입니다.
                  강한 난시는 토릭(난시용) 렌즈를 권장합니다.
                </p>
              </div>
            )}

            {/* 🎯 추천 조합 — 한쪽 난시 등으로 양안에 다른 제품이 필요할 때 우선순위별 페어 */}
            {eyeMode === 'both' && hasAstigmaticEye && pairRecs.length > 0 && (
              <div className="space-y-2 rounded-2xl border border-brand-200 bg-white p-3">
                <div className="flex items-baseline justify-between">
                  <div className="text-xs font-semibold text-gray-900">
                    🎯 추천 조합
                  </div>
                  <div className="text-[10px] text-gray-400">우안 우선 · 가까운 순</div>
                </div>
                <p className="text-[11px] text-gray-500">
                  좌·우 도수에 맞춰 ① 양안 동일 제품 → ② 같은 브랜드 순으로 추천합니다. 선택하면 양안에
                  한 번에 적용됩니다.
                </p>
                <div className="space-y-1.5">
                  {pairRecs.map((rec) => (
                    <PairCard
                      key={rec.key}
                      rec={rec}
                      needRight={needRight}
                      needLeft={needLeft}
                      selected={pairPickKey === rec.key}
                      onSelect={() => {
                        setPairPickKey(pairPickKey === rec.key ? null : rec.key);
                        setSelectedLensId(null);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 보조 필터 — 검색 / 타입 */}
            <div className="relative">
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="제품명으로 검색"
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-9 text-sm placeholder-gray-400 focus:border-brand-500 focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="검색 지우기"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1">
              {TYPE_TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTypeKey(t.key)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                    typeKey === t.key
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* 카운트 */}
            {lenses.length > 0 && (
              <div className="text-[11px] text-gray-500">
                {filteredLenses.length} / {lenses.length}종 표시
                {hasDoseToOrder && (
                  <span className="ml-1">
                    · 도수 가능{' '}
                    <span className="text-brand-700">{doseMatchCount}종</span>
                    {' · '}
                    즉시 주문{' '}
                    <span className="text-emerald-700">{inStockCount}종</span>
                  </span>
                )}
              </div>
            )}

            {/* 재고 없음 안내 — 도수 매칭은 있는데 재고가 0종일 때 */}
            {hasDoseToOrder && doseMatchCount > 0 && inStockCount === 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                <strong>도수에 맞는 제품 {doseMatchCount}종</strong>이 있지만 모두 재고 입고 대기
                중입니다. 운영자에게 입고 예정을 문의해 주세요.
              </div>
            )}

            {/* 그리드 */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {filteredLenses.map((l) => {
                const elig = eligibilityByLens.get(l.lensId);
                const doseOK = elig?.doseMatch ?? !hasDoseToOrder;
                const stockOK = elig?.inStock ?? !hasDoseToOrder;
                const clickable = doseOK; // 재고 없어도 카드 선택은 가능 (사유 표시)
                const selected = selectedLensId === l.lensId;
                const imageSrc = l.imageUrl ?? `/api/lens-image/${l.productCode}`;
                return (
                  <button
                    key={l.lensId}
                    type="button"
                    onClick={() => {
                      if (clickable) {
                        setSelectedLensId(l.lensId);
                        setPairPickKey(null);
                      }
                    }}
                    disabled={!clickable}
                    aria-disabled={!clickable}
                    className={`group overflow-hidden rounded-2xl border text-left transition ${
                      selected
                        ? 'border-brand-600 ring-2 ring-brand-600'
                        : clickable
                          ? 'border-gray-200 hover:border-brand-300'
                          : 'border-gray-200 cursor-not-allowed'
                    }`}
                  >
                    <div
                      className={`relative aspect-[3/4] w-full overflow-hidden bg-gray-100 ${
                        !doseOK ? 'opacity-60 grayscale' : !stockOK ? 'opacity-80' : ''
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageSrc}
                        alt={l.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-transparent" />
                      {l.isNew && !selected && doseOK && (
                        <span className="absolute left-2 top-2 rounded-full bg-pink-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow">
                          NEW
                        </span>
                      )}
                      {l.colorHex && doseOK && (
                        <div className="absolute bottom-10 right-2 flex items-center gap-1 rounded-full bg-white/90 px-1.5 py-0.5 shadow backdrop-blur">
                          <span
                            className="h-3 w-3 rounded-full border border-gray-200"
                            style={{ background: `radial-gradient(circle at 35% 35%, ${l.colorHex}66, ${l.colorHex})` }}
                          />
                          {l.colorName && (
                            <span className="text-[9px] font-medium text-gray-700">{l.colorName}</span>
                          )}
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-2.5 text-white">
                        <p className="truncate text-[10px] font-medium opacity-70">{l.brand}</p>
                        <p className="line-clamp-2 text-xs font-semibold leading-tight">{l.name}</p>
                      </div>
                      {selected && (
                        <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-brand-600 text-white text-sm font-bold shadow">
                          ✓
                        </span>
                      )}
                      {!doseOK && elig && elig.reasons.length > 0 && (
                        <div className="absolute inset-x-0 top-0 bg-red-600/95 px-2 py-1 text-center text-[10px] font-medium text-white">
                          {elig.reasons.join(' · ')}
                        </div>
                      )}
                      {doseOK && !stockOK && (
                        <div className="absolute inset-x-0 top-0 bg-amber-500/95 px-2 py-1 text-center text-[10px] font-medium text-white">
                          재고 없음 (도수 매칭 ✓)
                        </div>
                      )}
                      {doseOK && stockOK &&
                        (elig?.leftMethod === 'se' || elig?.rightMethod === 'se') && (
                          <div className="absolute left-2 top-2 rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow">
                            구면등가
                          </div>
                        )}
                    </div>
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-[10px] text-gray-400">
                        {l.replacementCycle} · {l.piecesPerBox}매
                      </span>
                      <span className="text-xs font-bold text-brand-700">
                        {formatKRW(l.price)}
                      </span>
                    </div>
                  </button>
                );
              })}
              {lenses.length === 0 && (
                <div className="col-span-full rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
                  등록된 렌즈가 없습니다
                </div>
              )}
              {lenses.length > 0 && filteredLenses.length === 0 && (
                <div className="col-span-full rounded-2xl border border-dashed border-gray-300 p-8 text-center">
                  <p className="text-4xl">🔍</p>
                  <div className="mt-3 text-sm font-medium text-gray-600">
                    {showOnlyEligible && hasDoseToOrder ? (
                      doseMatchCount === 0 ? (
                        <>
                          <span>
                            {eyeMode === 'right-only'
                              ? '우안'
                              : eyeMode === 'left-only'
                                ? '좌안'
                                : '양안'}{' '}
                            도수에 맞는{' '}
                            {typeKey !== 'all'
                              ? `‘${TYPE_TABS.find((t) => t.key === typeKey)?.label ?? ''}’ `
                              : ''}
                            제품이 없습니다
                          </span>
                          <span className="mt-1.5 block text-xs font-normal text-gray-400">
                            다른 카테고리를 고르거나, 아래 <strong>전체 제품 보기</strong>로 확인하세요.
                            {typeKey !== 'all' && ' (카테고리 필터를 풀면 더 많이 보일 수 있어요)'}
                          </span>
                        </>
                      ) : (
                        `내 도수 가능 ${doseMatchCount}종 중 해당 필터에 해당하는 제품이 없습니다`
                      )
                    ) : (
                      '조건에 맞는 제품이 없습니다'
                    )}
                  </div>
                  <div className="mt-3 flex justify-center gap-2">
                    {hasFilter && (
                      <button
                        type="button"
                        onClick={() => {
                          setQuery('');
                          setTypeKey('all');
                          setBrand('');
                        }}
                        className="rounded-full bg-gray-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-gray-700"
                      >
                        필터 초기화
                      </button>
                    )}
                    {showOnlyEligible && hasDoseToOrder && (
                      <button
                        type="button"
                        onClick={() => setShowOnlyEligible(false)}
                        className="rounded-full border border-gray-300 bg-white px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        전체 제품 보기
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {hasFilter && filteredLenses.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setTypeKey('all');
                  setBrand('');
                }}
                className="text-xs text-gray-500 underline hover:text-gray-700"
              >
                필터 초기화
              </button>
            )}
          </>
        )}
      </section>

      {/* 3. 픽업가맹점 */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">3. 픽업가맹점 선택</h2>

        {stores.length > 0 && (() => {
          const availableRegions = new Set(
            stores.map((s) => regionOf(s.address)).filter((r): r is string => !!r),
          );
          const orderedRegions = REGION_GROUPS
            .map((g) => g.key)
            .filter((k) => availableRegions.has(k));
          return (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setStoreRegion(null)}
                className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${
                  !storeRegion
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
                }`}
              >
                전체 ({stores.length})
              </button>
              {orderedRegions.map((r) => {
                const count = stores.filter((s) => regionOf(s.address) === r).length;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setStoreRegion(storeRegion === r ? null : r)}
                    className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${
                      storeRegion === r
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {r} ({count})
                  </button>
                );
              })}
            </div>
          );
        })()}

        {!storeRegion ? (
          <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
            {stores.length === 0
              ? '등록된 가맹점이 없습니다'
              : '먼저 지역을 선택하면 픽업가맹점 목록이 표시됩니다'}
          </div>
        ) : (
          (() => {
            const regionStores = stores.filter((s) => regionOf(s.address) === storeRegion);
            if (regionStores.length === 0) {
              return (
                <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
                  {storeRegion} 지역에 등록된 가맹점이 없습니다
                </div>
              );
            }
            return (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {regionStores.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStoreId(s.id)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      storeId === s.id
                        ? 'border-brand-600 bg-brand-50'
                        : 'border-gray-200 bg-white hover:border-brand-300'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="font-semibold">{s.name}</div>
                      <span className="text-[10px] font-medium text-brand-600">{storeRegion}</span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">{s.phone}</div>
                    <div className="mt-1 text-xs text-gray-500">{s.address}</div>
                  </button>
                ))}
              </div>
            );
          })()
        )}
      </section>

      {/* 4. 결제 */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">4. 결제 방식</h2>
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          픽업 시 <span className="font-semibold">매장에서 결제</span>합니다.
        </div>

        <textarea
          className="w-full rounded-lg border border-gray-300 p-3 text-sm"
          rows={2}
          placeholder="요청사항 (선택)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </section>

      {/* 합계 + 제출 */}
      <section
        className="fixed inset-x-0 bottom-14 z-20 border-t border-gray-200 bg-white p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] md:sticky md:bottom-4 md:inset-x-auto md:rounded-2xl md:border md:shadow-md"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-1 md:px-0">
          <div className="min-w-0">
            <div className="text-xs text-gray-500">결제 예정 금액</div>
            <div className="truncate text-xl font-bold">{formatKRW(total)}</div>
          </div>
          <Button onClick={onSubmit} disabled={!canSubmit} size="lg" className="min-w-[40%] md:min-w-0">
            {submitting ? '주문 중...' : '주문하기'}
          </Button>
        </div>
        {disabledReason ? (
          <p className="mt-2 text-xs text-amber-600">⚠ {disabledReason}</p>
        ) : error ? (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        ) : null}
      </section>

      {/* 도수 관리 모달 */}
      {doseModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          onClick={async () => {
            setDoseModalOpen(false);
            await loadSavedDose();
          }}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-gray-900">콘택트 도수 관리</h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  입력 후 닫기를 누르면 주문 화면에 자동 반영됩니다.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  setDoseModalOpen(false);
                  await loadSavedDose();
                }}
                className="grid h-8 w-8 place-items-center rounded-full text-gray-400 hover:bg-gray-100"
                aria-label="닫기"
              >
                ✕
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-5">
              <PrescriptionManager endpoint="/api/customer/prescriptions" canEdit />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 주문 대상 라디오 (양안 / 우안만 / 좌안만). */
function EyeModeRadio({
  value,
  current,
  onChange,
  disabled,
  label,
}: {
  value: EyeMode;
  current: EyeMode;
  onChange: (m: EyeMode) => void;
  disabled?: boolean;
  label: string;
}) {
  const active = current === value;
  return (
    <label
      className={`inline-flex items-center gap-1.5 ${
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
      }`}
    >
      <input
        type="radio"
        name="eyeMode"
        value={value}
        checked={active}
        disabled={disabled}
        onChange={() => onChange(value)}
        className="h-3.5 w-3.5 accent-brand-600"
      />
      <span className={active ? 'font-semibold text-brand-700' : 'text-gray-700'}>
        {label}
      </span>
    </label>
  );
}

/** 선택된 제품의 한쪽 변형 + 수량 입력 + 라인 합계.
 *  product 가 주어지면(양안 다른 제품) 눈별 제품명을 함께 표시. */
function VariantQtyRow({
  side,
  variant,
  qty,
  onQtyChange,
  method,
  product,
}: {
  side: string;
  variant: LensVariant;
  qty: number;
  onQtyChange: (q: number) => void;
  method?: MatchMethod | null;
  product?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2 text-gray-700">
      <span className="text-[11px] font-semibold text-gray-600">{side}</span>
      {product && (
        <span className="min-w-0 max-w-[45%] truncate text-[11px] font-medium text-brand-700">
          {product}
        </span>
      )}
      <span className="min-w-0 truncate text-xs">{formatVariantLabel(variant)}</span>
      {method === 'se' && (
        <span
          className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
          title="구면등가 변환으로 매칭됨 — 약한 난시의 간이 보정"
        >
          구면등가
        </span>
      )}
      {variant.available <= 0 && (
        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
          재고 없음
        </span>
      )}
      <div className="ml-auto flex items-center gap-1.5">
        <span className="text-[11px] text-gray-500">수량</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={20}
          value={qty}
          onChange={(e) => onQtyChange(Math.max(1, Number(e.target.value) || 1))}
          className="h-8 w-14 rounded-lg border border-gray-300 px-2 text-center text-sm"
        />
        <span className="text-[11px] text-gray-500">박스</span>
        <span className="ml-2 min-w-[70px] text-right text-xs font-semibold">
          {formatKRW(variant.price * qty)}
        </span>
      </div>
    </div>
  );
}

/** 추천 조합 카드 — 우/좌 각각의 추천 렌즈를 한 그룹(조합)으로 제시. */
function PairCard({
  rec,
  needRight,
  needLeft,
  selected,
  onSelect,
}: {
  rec: PairRec;
  needRight: boolean;
  needLeft: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const eyeRow = (label: string, pick: EyePick) => (
    <div className="flex flex-wrap items-baseline gap-1.5 text-[11px]">
      <span className="font-semibold text-gray-600">{label}</span>
      <span className="font-medium text-brand-700">
        {pick.lens.brand} {pick.lens.name}
      </span>
      <span className="font-mono text-gray-700">{formatVariantLabel(pick.variant)}</span>
      {pick.method === 'se' && (
        <span className="rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-700">
          구면등가
        </span>
      )}
      {pick.variant.available <= 0 && (
        <span className="rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-700">
          재고 대기
        </span>
      )}
    </div>
  );
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border p-2.5 text-left transition ${
        selected
          ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600'
          : 'border-gray-200 bg-white hover:border-brand-300'
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-medium text-white">
          {TIER_LABEL[rec.tier]}
        </span>
        <span className="shrink-0 text-[11px] font-semibold text-gray-900">
          {formatKRW(rec.total)} <span className="font-normal text-gray-400">/ 1박스</span>
        </span>
      </div>
      <div className="space-y-0.5">
        {needRight && eyeRow('우 (R)', rec.right)}
        {needLeft && eyeRow('좌 (L)', rec.left)}
      </div>
    </button>
  );
}

/** 도수 표시 칩 — read-only. 양/우/좌 한 줄(데스크탑) 또는 stacked(모바일) 노출. */
function EyeChip({ label, dose }: { label: string; dose: EyeData | null }) {
  if (!dose) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 px-3 py-2 text-xs text-gray-400">
        <span className="font-medium text-gray-600">{label}</span> · 등록된 도수 없음
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-1.5">
        <div className="text-xs font-semibold text-emerald-900">{label}</div>
        <div className="text-xs font-mono text-emerald-800">{eyeSummary(dose)}</div>
      </div>
    </div>
  );
}

function formatSign(v: string | null): string {
  if (v == null) return '-';
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  return (n >= 0 ? '+' : '') + n.toFixed(2);
}

/** 저장된 도수가 제품 variants 에 존재하는지 매칭 (재고 무관).
 *  재고 확인은 호출 측에서 별도 처리 — 재고 없음 vs 도수 미지원을 구분해서 보여주기 위함.
 *  규칙:
 *   - 난시 고객 (|CYL|≥0.5): 토릭 변형만. 굴절력 벡터(M/J0/J45) 거리를 최소화하는 SKU 선택 —
 *     가용 축 중 가장 가까운 축을 적용하고 축·원주 차이를 구면등가/원주로 보정한 최적 도수가 됨.
 *     (구면 렌즈로 간이 보정하려면 호출 측에서 구면등가(SE) 도수로 별도 매칭)
 *   - 비-난시 고객: 구면 변형만 (SPH 엄격 일치). 토릭은 오히려 난시 추가 → 거부.
 *   - 비-다초점 변형 (vAdd=0): 누구나 — 다초점 필요한 고객도 거리 시력 보정만 받음
 *   - 다초점 변형 (vAdd≠0): 고객 ADD 와 정확 일치 필요
 *  동점/후보 다수면 재고 있는 variant 우선. */
function matchVariant(variants: LensVariant[], dose: EyeData): LensVariant | null {
  const targetSph = Number(dose.sphere);
  const targetCyl = normCorrection(dose.cylinder);
  const targetAdd = normCorrection(dose.addPower);
  const astig = Math.abs(targetCyl) >= ASTIGMATISM_MIN; // 난시 교정 대상
  let best: LensVariant | null = null;
  let bestScore = Infinity; // 작을수록 우선
  if (astig) {
    // 난시 → 토릭만. 굴절력 벡터 거리로 매칭: 가용 축 중 가장 가까운 축을 적용하고,
    // 축·원주 차이를 구면등가/원주로 보정한 "가장 가까운 도수" SKU 를 자동 선택.
    const target = powerVector(targetSph, targetCyl, dose.axis);
    for (const v of variants) {
      const vCyl = normCorrection(v.cylinder);
      if (vCyl === 0) continue; // 구면 렌즈는 난시 미보정 → 제외
      const vAdd = normCorrection(v.addPower);
      if (vAdd !== 0 && vAdd !== targetAdd) continue; // 다초점은 ADD 정확 일치
      const dist = dioptricDistance(target, powerVector(Number(v.sphere), vCyl, v.axis));
      if (dist > TORIC_MATCH_MAX) continue; // 교정 불가 수준이면 제외
      const score = dist + (v.available > 0 ? 0 : 1000); // 재고 있는 variant 우선
      if (score < bestScore) {
        best = v;
        bestScore = score;
      }
    }
    return best;
  }
  // 비난시 → 구면만 (토릭은 오히려 난시 추가 → 제외). SPH 정확, 다초점 ADD 정확.
  for (const v of variants) {
    if (Number(v.sphere) !== targetSph) continue;
    const vCyl = normCorrection(v.cylinder);
    if (vCyl !== 0) continue;
    const vAdd = normCorrection(v.addPower);
    if (vAdd !== 0 && vAdd !== targetAdd) continue;
    const score = v.available > 0 ? 0 : 1000;
    if (score < bestScore) {
      best = v;
      bestScore = score;
    }
  }
  return best;
}

/** "0", "0.00", "", null → 0. 그 외엔 Number(). 보정값(CYL/ADD) 비교용. */
/** 구면등가(SE = SPH + CYL/2) 변환. CYL=0 또는 |CYL|>0.75 면 null (난시 없음 / 강한 난시는 토릭 권장).
 *  반환값은 SPH 만 가진 도수 (CYL/AXIS null) — 구면 lens 와 매칭 가능. */
function sphericalEquivalent(dose: EyeData): EyeData | null {
  const sph = Number(dose.sphere);
  const cyl = normCorrection(dose.cylinder);
  if (cyl === 0) return null;
  if (Math.abs(cyl) > 0.75) return null;
  const se = sph + cyl / 2;
  const seRounded = Math.round(se * 4) / 4; // 0.25 단위
  const sign = seRounded >= 0 ? '+' : '';
  return {
    sphere: `${sign}${seRounded.toFixed(2)}`,
    cylinder: null,
    axis: null,
    addPower: dose.addPower,
  };
}

/** 한쪽 눈 매칭 — 정확(exact) 시도 → 실패 시 구면등가(SE) fallback (허용 시).
 *  반환값에 매칭 방법 표시. */
function matchEye(
  variants: LensVariant[],
  dose: EyeData,
  allowSE: boolean,
): { variant: LensVariant; method: MatchMethod } | null {
  const exact = matchVariant(variants, dose);
  if (exact) return { variant: exact, method: 'exact' };
  if (!allowSE) return null;
  const se = sphericalEquivalent(dose);
  if (!se) return null;
  const seMatch = matchVariant(variants, se);
  return seMatch ? { variant: seMatch, method: 'se' } : null;
}

function normCorrection(v: string | null | undefined): number {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** 난시 교정 대상 최소 CYL — |CYL| ≥ 0.5 면 토릭(난시용) 필요, 미만은 구면 취급.
 *  (recommend.ts 의 needToric, convert.ts 의 mapToricCylinder 와 동일 임계값) */
const ASTIGMATISM_MIN = 0.5;
function isAstigmatic(cyl: string | null | undefined): boolean {
  return Math.abs(normCorrection(cyl)) >= ASTIGMATISM_MIN;
}

/** 토릭 근사 매칭 최대 허용 굴절력 거리(디옵터). 이 이상 차이나면 그 제품은 해당 눈을
 *  제대로 교정 못 하는 것으로 보고 제외. (축 스냅·원주 1단계 반올림은 보통 이 안에 들어옴) */
const TORIC_MATCH_MAX = 0.75;

/** 제품군(라인) 키 — 같은 브랜드의 구면/난시용 같은 라인을 묶기 위한 정규화 제품명.
 *  '난시용/토릭/다초점/구면' 등 변형 표기를 제거한 베이스 제품명 + 브랜드. */
function productLineKey(lens: Lens): string {
  const base = lens.name
    .replace(/난시(용)?|토릭|toric|astigmat\w*|for\s+astigmatism|다초점|멀티포컬|multifocal|구면/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return `${lens.brand.toLowerCase()}|${base}`;
}

/** 한 제품에서 한쪽 눈 매칭 — 정확 우선, 실패 시 구면등가(SE) 후보. */
function pickEye(
  lens: Lens,
  dose: EyeData,
  se: EyeData | null,
): { variant: LensVariant; method: MatchMethod } | null {
  const exact = matchVariant(lens.variants, dose);
  if (exact) return { variant: exact, method: 'exact' };
  if (se) {
    const seMatch = matchVariant(lens.variants, se);
    if (seMatch) return { variant: seMatch, method: 'se' };
  }
  return null;
}

/** 추천 조합 정렬 점수 (작을수록 우선): tier → 재고 → 동일제품 → 저가. */
function rankPair(r: PairRec): number {
  let s = TIER_RANK[r.tier] * 1000;
  if (!r.inStock) s += 400; // 재고 없는 조합은 뒤로
  if (!r.sameProduct) s += 30; // 같은 단계면 동일 제품을 살짝 우대
  s += Math.min(r.total / 100000, 20); // 가격 미세 가중
  return s;
}

/**
 * 좌·우 도수에 맞춘 추천 조합 생성 — 한쪽만 난시 등으로 단일 제품 양안 매칭이
 * 어려운 경우의 대안. 우선순위:
 *   ① 양안 동일 제품(정확)  ② 양안 동일 제품(난시 쪽 구면등가 변환)
 *   ③ 같은 브랜드·같은 라인(난시용+구면)  ④ 같은 브랜드(제품 매칭)
 * 반환은 우선순위 정렬, 상위 6개. (right/left 는 항상 우안 먼저로 다룬다)
 */
function buildPairRecs(lenses: Lens[], rightDose: EyeData, leftDose: EyeData): PairRec[] {
  const rightSE = sphericalEquivalent(rightDose); // 난시 아니면 null
  const leftSE = sphericalEquivalent(leftDose);

  const recs: PairRec[] = [];
  const seen = new Set<string>();
  const mk = (tier: PairTier, right: EyePick, left: EyePick): PairRec => ({
    key: `${right.lens.lensId}:${right.variant.variantId}|${left.lens.lensId}:${left.variant.variantId}`,
    tier,
    right,
    left,
    sameProduct: right.lens.lensId === left.lens.lensId,
    sameBrand: right.lens.brand === left.lens.brand,
    inStock: right.variant.available > 0 && left.variant.available > 0,
    total: right.variant.price + left.variant.price,
  });
  const push = (r: PairRec) => {
    if (seen.has(r.key)) return;
    seen.add(r.key);
    recs.push(r);
  };

  // 눈별 정확 매칭 후보 (제품별 1 variant)
  const rightExact: EyePick[] = [];
  const leftExact: EyePick[] = [];
  for (const l of lenses) {
    const rv = matchVariant(l.variants, rightDose);
    if (rv) rightExact.push({ lens: l, variant: rv, method: 'exact' });
    const lv = matchVariant(l.variants, leftDose);
    if (lv) leftExact.push({ lens: l, variant: lv, method: 'exact' });
  }

  // ① 양안 동일 제품(정확)
  const rightExactByLens = new Map(rightExact.map((p) => [p.lens.lensId, p]));
  for (const lp of leftExact) {
    const rp = rightExactByLens.get(lp.lens.lensId);
    if (rp) push(mk('same-exact', rp, lp));
  }

  // ② 양안 동일 제품(구면등가) — 난시 쪽을 SE 변환해 한 제품으로 양안
  if (rightSE || leftSE) {
    for (const l of lenses) {
      const rp = pickEye(l, rightDose, rightSE);
      const lp = pickEye(l, leftDose, leftSE);
      if (rp && lp && (rp.method === 'se' || lp.method === 'se')) {
        push(mk('same-se', { lens: l, ...rp }, { lens: l, ...lp }));
      }
    }
  }

  // ③④ 같은 브랜드 서로 다른 제품 페어 (브랜드별 best 1개씩)
  const brands = new Set([...rightExact, ...leftExact].map((p) => p.lens.brand));
  for (const brand of brands) {
    const rs = rightExact.filter((p) => p.lens.brand === brand);
    const ls = leftExact.filter((p) => p.lens.brand === brand);
    if (!rs.length || !ls.length) continue;

    let bestLine: PairRec | null = null; // ③ 같은 라인
    let bestBrand: PairRec | null = null; // ④ 같은 브랜드 임의 제품
    for (const r of rs) {
      for (const l of ls) {
        if (r.lens.lensId === l.lens.lensId) continue; // 동일 제품은 ①②에서 처리
        const candBrand = mk('brand', r, l);
        if (!bestBrand || rankPair(candBrand) < rankPair(bestBrand)) bestBrand = candBrand;
        if (productLineKey(r.lens) === productLineKey(l.lens)) {
          const candLine = mk('brand-line', r, l);
          if (!bestLine || rankPair(candLine) < rankPair(bestLine)) bestLine = candLine;
        }
      }
    }
    if (bestLine) push(bestLine);
    if (bestBrand) push(bestBrand);
  }

  recs.sort((a, b) => rankPair(a) - rankPair(b));
  return recs.slice(0, 6);
}

function formatVariantLabel(v: LensVariant): string {
  const parts = [`SPH ${formatSign(v.sphere)}`];
  if (v.cylinder && Number(v.cylinder) !== 0) parts.push(`CYL ${formatSign(v.cylinder)}`);
  if (v.axis != null) parts.push(`AX ${v.axis}`);
  if (v.addPower && Number(v.addPower) !== 0) parts.push(`ADD ${formatSign(v.addPower)}`);
  return parts.join(' · ');
}

function eyeSummary(eye: EyeData | null): string {
  if (!eye) return '-';
  const parts = [`SPH ${formatSign(eye.sphere)}`];
  if (eye.cylinder) parts.push(`CYL ${formatSign(eye.cylinder)}`);
  if (eye.axis !== null) parts.push(`AXIS ${eye.axis}`);
  if (eye.addPower) parts.push(`ADD ${formatSign(eye.addPower)}`);
  return parts.join(' · ');
}
