'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PrescriptionManager } from '@/components/prescription/prescription-manager';
import { formatKRW } from '@/lib/utils/format';

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
  if (key === 'extended') return l.replacementCycle !== '1day' && !isColored(l) && l.lensType !== 'multifocal';
  if (key === 'toric') return l.lensType === 'toric';
  if (key === 'multifocal') return l.lensType === 'multifocal';
  return true;
}

interface LensEligibility {
  eligible: boolean;
  leftVariant: LensVariant | null;
  rightVariant: LensVariant | null;
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

  // 주문 의도 — 눈별 미주문 / 수량
  const [leftSkip, setLeftSkip] = useState(false);
  const [rightSkip, setRightSkip] = useState(false);
  const [leftQty, setLeftQty] = useState(1);
  const [rightQty, setRightQty] = useState(1);

  // 제품 선택
  const [selectedLensId, setSelectedLensId] = useState<string | null>(null);

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
      const latestContact = groups.find((g) => g.kind === 'contact');
      if (latestContact) {
        setSavedDose({
          left: latestContact.left,
          right: latestContact.right,
          recordedAt: latestContact.recordedAt,
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

  // 도수 + 미주문 토글로부터 "필요 도수" 도출
  const needLeft = !!savedDose.left && !leftSkip;
  const needRight = !!savedDose.right && !rightSkip;
  const hasDoseToOrder = needLeft || needRight;

  // 제품별 적합성 계산
  const eligibilityByLens = useMemo(() => {
    const map = new Map<string, LensEligibility>();
    for (const l of lenses) {
      const leftVariant = needLeft && savedDose.left
        ? matchVariant(l.variants, savedDose.left)
        : null;
      const rightVariant = needRight && savedDose.right
        ? matchVariant(l.variants, savedDose.right)
        : null;
      const eligible =
        (!needLeft || !!leftVariant) && (!needRight || !!rightVariant);
      const reasons: string[] = [];
      if (needLeft && !leftVariant) reasons.push('좌안 도수 없음');
      if (needRight && !rightVariant) reasons.push('우안 도수 없음');
      map.set(l.lensId, { eligible, leftVariant, rightVariant, reasons });
    }
    return map;
  }, [lenses, savedDose, needLeft, needRight]);

  const selectedLens = useMemo(
    () => lenses.find((l) => l.lensId === selectedLensId) ?? null,
    [lenses, selectedLensId],
  );
  const selectedElig = selectedLens
    ? eligibilityByLens.get(selectedLens.lensId) ?? null
    : null;

  // 선택한 제품이 도수 변경 등으로 부적합해지면 해제
  useEffect(() => {
    if (selectedLens && selectedElig && !selectedElig.eligible) {
      setSelectedLensId(null);
    }
  }, [selectedLens, selectedElig]);

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
    if (showOnlyEligible && hasDoseToOrder) {
      list = list.filter(
        (l) => eligibilityByLens.get(l.lensId)?.eligible ?? false,
      );
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

  const eligibleCount = useMemo(
    () =>
      hasDoseToOrder
        ? lenses.filter((l) => eligibilityByLens.get(l.lensId)?.eligible).length
        : lenses.length,
    [lenses, eligibilityByLens, hasDoseToOrder],
  );

  const hasFilter = Boolean(brand || typeKey !== 'all' || query.trim());

  const total = useMemo(() => {
    if (!selectedElig) return 0;
    let sum = 0;
    if (selectedElig.leftVariant) sum += selectedElig.leftVariant.price * leftQty;
    if (selectedElig.rightVariant) sum += selectedElig.rightVariant.price * rightQty;
    return sum;
  }, [selectedElig, leftQty, rightQty]);

  const canSubmit =
    !!selectedLens &&
    !!selectedElig &&
    selectedElig.eligible &&
    !!storeId &&
    hasDoseToOrder &&
    !submitting;

  async function onSubmit() {
    if (!canSubmit || !selectedElig) return;
    setSubmitting(true);
    setError(null);
    const lines: Array<{ variantId: string; eyeSide: EyeSide; quantity: number }> = [];
    if (selectedElig.leftVariant) {
      lines.push({
        variantId: selectedElig.leftVariant.variantId,
        eyeSide: 'left',
        quantity: leftQty,
      });
    }
    if (selectedElig.rightVariant) {
      lines.push({
        variantId: selectedElig.rightVariant.variantId,
        eyeSide: 'right',
        quantity: rightQty,
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
    <div className="space-y-6 pb-32 md:space-y-8 md:pb-0">
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
            <EyeDoseRow
              label="좌 (L, OS)"
              dose={savedDose.left}
              skip={leftSkip}
              onSkipChange={setLeftSkip}
              quantity={leftQty}
              onQuantityChange={setLeftQty}
            />
            <EyeDoseRow
              label="우 (R, OD)"
              dose={savedDose.right}
              skip={rightSkip}
              onSkipChange={setRightSkip}
              quantity={rightQty}
              onQuantityChange={setRightQty}
            />
            {!hasDoseToOrder && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                주문할 눈을 최소 1개 이상 선택해 주세요.
              </div>
            )}
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

        {!hasDoseToOrder ? (
          <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
            먼저 도수를 등록하고 주문할 눈을 선택해 주세요.
          </div>
        ) : (
          <>
            {/* 선택된 제품 요약 (선택 후에도 상단 노출) */}
            {selectedLens && selectedElig && (
              <div className="space-y-2 rounded-2xl border-2 border-brand-600 bg-brand-50 p-3">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedLens.imageUrl ?? `/api/lens-image/${selectedLens.productCode}`}
                    alt={selectedLens.name}
                    className="h-14 w-14 shrink-0 rounded-lg bg-white object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] font-medium uppercase tracking-wider text-brand-700">
                      {selectedLens.brand} · 선택됨
                    </p>
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {selectedLens.name}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {selectedLens.replacementCycle} · {selectedLens.piecesPerBox}매
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedLensId(null)}
                    className="shrink-0 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-400"
                  >
                    변경
                  </button>
                </div>
                <div className="space-y-1 text-xs">
                  {selectedElig.leftVariant && (
                    <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-gray-700">
                      <span>
                        좌 (L): {formatVariantLabel(selectedElig.leftVariant)} × {leftQty}박스
                      </span>
                      <span className="font-semibold">
                        {formatKRW(selectedElig.leftVariant.price * leftQty)}
                      </span>
                    </div>
                  )}
                  {selectedElig.rightVariant && (
                    <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-gray-700">
                      <span>
                        우 (R): {formatVariantLabel(selectedElig.rightVariant)} × {rightQty}박스
                      </span>
                      <span className="font-semibold">
                        {formatKRW(selectedElig.rightVariant.price * rightQty)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 검색바 */}
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
                placeholder="제품명, 브랜드로 검색"
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

            {/* 타입 필터 */}
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

            {/* 브랜드 필터 */}
            {brands.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1">
                <button
                  type="button"
                  onClick={() => setBrand('')}
                  className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium transition ${
                    brand === ''
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-200 text-gray-500 hover:border-gray-400'
                  }`}
                >
                  전체
                </button>
                {brands.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBrand(brand === b ? '' : b)}
                    className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium transition ${
                      brand === b
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 text-gray-500 hover:border-gray-400'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            )}

            {/* 카운트 */}
            {lenses.length > 0 && (
              <div className="text-[11px] text-gray-500">
                {filteredLenses.length} / {lenses.length}종 표시
                {hasDoseToOrder && (
                  <span className="ml-1 text-brand-700">
                    · 내 도수 가능: {eligibleCount}종
                  </span>
                )}
              </div>
            )}

            {/* 그리드 */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {filteredLenses.map((l) => {
                const elig = eligibilityByLens.get(l.lensId);
                const isEligible = elig?.eligible ?? !hasDoseToOrder;
                const selected = selectedLensId === l.lensId;
                const imageSrc = l.imageUrl ?? `/api/lens-image/${l.productCode}`;
                return (
                  <button
                    key={l.lensId}
                    type="button"
                    onClick={() => {
                      if (isEligible) setSelectedLensId(l.lensId);
                    }}
                    disabled={!isEligible}
                    aria-disabled={!isEligible}
                    className={`group overflow-hidden rounded-2xl border text-left transition ${
                      selected
                        ? 'border-brand-600 ring-2 ring-brand-600'
                        : isEligible
                          ? 'border-gray-200 hover:border-brand-300'
                          : 'border-gray-200 cursor-not-allowed'
                    }`}
                  >
                    <div
                      className={`relative aspect-[3/4] w-full overflow-hidden bg-gray-100 ${
                        !isEligible ? 'opacity-60 grayscale' : ''
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
                      {l.isNew && !selected && isEligible && (
                        <span className="absolute left-2 top-2 rounded-full bg-pink-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow">
                          NEW
                        </span>
                      )}
                      {l.colorHex && isEligible && (
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
                      {!isEligible && elig && elig.reasons.length > 0 && (
                        <div className="absolute inset-x-0 top-0 bg-red-600/95 px-2 py-1 text-center text-[10px] font-medium text-white">
                          {elig.reasons.join(' · ')}
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
                  <p className="mt-3 text-sm font-medium text-gray-600">
                    {showOnlyEligible && hasDoseToOrder
                      ? '내 도수로 주문 가능한 제품이 없습니다'
                      : '조건에 맞는 제품이 없습니다'}
                  </p>
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
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
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

function EyeDoseRow({
  label,
  dose,
  skip,
  onSkipChange,
  quantity,
  onQuantityChange,
}: {
  label: string;
  dose: EyeData | null;
  skip: boolean;
  onSkipChange: (v: boolean) => void;
  quantity: number;
  onQuantityChange: (v: number) => void;
}) {
  if (!dose) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 px-3 py-2.5 text-xs text-gray-400">
        <span className="font-medium text-gray-600">{label}</span> · 등록된 도수 없음
      </div>
    );
  }
  const active = !skip;
  return (
    <div
      className={`rounded-lg border px-3 py-2.5 transition ${
        active
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-gray-200 bg-gray-50'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div
            className={`text-xs font-semibold ${
              active ? 'text-emerald-900' : 'text-gray-500'
            }`}
          >
            {label}
          </div>
          <div
            className={`mt-0.5 text-xs font-mono ${
              active ? 'text-emerald-800' : 'text-gray-400 line-through'
            }`}
          >
            {eyeSummary(dose)}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {active && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-gray-500">수량</span>
              <input
                type="number"
                min={1}
                max={20}
                value={quantity}
                onChange={(e) =>
                  onQuantityChange(Math.max(1, Number(e.target.value) || 1))
                }
                className="h-8 w-14 rounded-lg border border-gray-300 px-2 text-center text-sm"
              />
              <span className="text-[11px] text-gray-500">박스</span>
            </div>
          )}
          <label className="flex items-center gap-1 text-[11px] text-gray-600">
            <input
              type="checkbox"
              checked={skip}
              onChange={(e) => onSkipChange(e.target.checked)}
              className="h-3.5 w-3.5 rounded"
            />
            주문 안 함
          </label>
        </div>
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

/** 저장된 도수가 제품 variants 에 존재하는지 매칭 (SPH/CYL/AXIS/ADD).
 *  재고 0 인 variant 는 주문 불가이므로 매칭에서 제외. */
function matchVariant(variants: LensVariant[], dose: EyeData): LensVariant | null {
  const targetSph = Number(dose.sphere);
  const targetCyl = dose.cylinder != null ? Number(dose.cylinder) : null;
  const targetAxis = dose.axis;
  const targetAdd = dose.addPower != null ? Number(dose.addPower) : null;
  return (
    variants.find((v) => {
      if (v.available <= 0) return false;
      if (Number(v.sphere) !== targetSph) return false;
      const vCyl = v.cylinder != null ? Number(v.cylinder) : null;
      if ((vCyl ?? null) !== (targetCyl ?? null)) return false;
      if ((v.axis ?? null) !== (targetAxis ?? null)) return false;
      const vAdd = v.addPower != null ? Number(v.addPower) : null;
      if ((vAdd ?? null) !== (targetAdd ?? null)) return false;
      return true;
    }) ?? null
  );
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
