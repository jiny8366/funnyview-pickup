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

// 광역시·도 그룹 — '5대 광역시 및 도'
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

interface EyeSelection {
  variantId: string | null;
  quantity: number;
}

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

export default function CustomerOrderPage() {
  const router = useRouter();
  const [lenses, setLenses] = useState<Lens[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedLensId, setSelectedLensId] = useState<string | null>(null);
  const [leftSel, setLeftSel] = useState<EyeSelection>({ variantId: null, quantity: 1 });
  const [rightSel, setRightSel] = useState<EyeSelection>({ variantId: null, quantity: 1 });
  // 등록된 콘택트 도수 (고객정보의 시력관리에서 저장한 최신값)
  const [savedDose, setSavedDose] = useState<{ left: EyeData | null; right: EyeData | null; recordedAt: string | null }>({ left: null, right: null, recordedAt: null });
  const [doseModalOpen, setDoseModalOpen] = useState(false);
  const [doseLoaded, setDoseLoaded] = useState(false);
  const [mismatch, setMismatch] = useState<string[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 제품 찾기 필터
  const [query, setQuery] = useState('');
  const [typeKey, setTypeKey] = useState<TypeKey>('all');
  const [brand, setBrand] = useState('');
  const [storeRegion, setStoreRegion] = useState<string | null>(null);

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

  // 등록된 콘택트 도수 불러오기 — 마이페이지 > 내 시력정보에서 저장한 값
  const loadSavedDose = useCallback(async () => {
    try {
      const res = await fetch('/api/customer/prescriptions');
      if (res.status === 401) {
        // 비로그인은 무시 (로그인 후 다시 진입 시 자동 로드)
        setDoseLoaded(true);
        return;
      }
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
      // ignore
    } finally {
      setDoseLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadSavedDose();
  }, [loadSavedDose]);

  const selectedLens = useMemo(
    () => lenses.find((l) => l.lensId === selectedLensId) ?? null,
    [lenses, selectedLensId],
  );

  // 선택한 제품의 variants 중 등록 도수와 매칭되는 것을 자동 선택, 매칭 실패 시 경고
  useEffect(() => {
    if (!selectedLens) {
      setMismatch([]);
      return;
    }
    const rMatch = savedDose.right ? matchVariant(selectedLens.variants, savedDose.right) : null;
    const lMatch = savedDose.left ? matchVariant(selectedLens.variants, savedDose.left) : null;
    if (rMatch) setRightSel({ variantId: rMatch.variantId, quantity: 1 });
    if (lMatch) setLeftSel({ variantId: lMatch.variantId, quantity: 1 });
    const missing: string[] = [];
    if (savedDose.right && !rMatch) missing.push('우안');
    if (savedDose.left && !lMatch) missing.push('좌안');
    setMismatch(missing);
  }, [selectedLens, savedDose]);

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
      list = list.filter((l) =>
        l.name.toLowerCase().includes(q) ||
        l.brand.toLowerCase().includes(q),
      );
    }
    return list;
  }, [lenses, brand, typeKey, query]);

  const hasFilter = Boolean(brand || typeKey !== 'all' || query.trim());

  const total = useMemo(() => {
    let sum = 0;
    if (selectedLens) {
      const lv = selectedLens.variants.find((v) => v.variantId === leftSel.variantId);
      const rv = selectedLens.variants.find((v) => v.variantId === rightSel.variantId);
      if (lv) sum += lv.price * leftSel.quantity;
      if (rv) sum += rv.price * rightSel.quantity;
    }
    return sum;
  }, [selectedLens, leftSel, rightSel]);

  const canSubmit =
    !!selectedLens &&
    !!storeId &&
    (leftSel.variantId !== null || rightSel.variantId !== null) &&
    !submitting;

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const lines: Array<{ variantId: string; eyeSide: EyeSide; quantity: number }> = [];
    if (leftSel.variantId) lines.push({ variantId: leftSel.variantId, eyeSide: 'left', quantity: leftSel.quantity });
    if (rightSel.variantId) lines.push({ variantId: rightSel.variantId, eyeSide: 'right', quantity: rightSel.quantity });

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
        <p className="mt-1 text-sm text-gray-500">상품 → 도수 → 픽업가맹점 → 결제</p>
      </header>

      {/* 1. 상품 선택 */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-gray-700">1. 상품 선택</h2>
          {lenses.length > 0 && (
            <span className="text-xs text-gray-400">
              {filteredLenses.length === lenses.length
                ? `${lenses.length}종`
                : `${filteredLenses.length} / ${lenses.length}종`}
            </span>
          )}
        </div>

        {/* 선택된 제품 요약 (선택 후에도 항상 보임) */}
        {selectedLens && (
          <div className="flex items-center gap-3 rounded-2xl border-2 border-brand-600 bg-brand-50 p-2.5">
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
              <p className="truncate text-sm font-semibold text-gray-900">{selectedLens.name}</p>
              <p className="text-[11px] text-gray-500">
                {selectedLens.replacementCycle} · {selectedLens.piecesPerBox}매 · {formatKRW(selectedLens.price)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedLensId(null);
                setLeftSel({ variantId: null, quantity: 1 });
                setRightSel({ variantId: null, quantity: 1 });
              }}
              className="shrink-0 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-400"
            >
              변경
            </button>
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

        {/* 결과 */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filteredLenses.map((l) => {
            const imageSrc = l.imageUrl ?? `/api/lens-image/${l.productCode}`;
            const selected = selectedLensId === l.lensId;
            return (
              <button
                key={l.lensId}
                type="button"
                onClick={() => {
                  setSelectedLensId(l.lensId);
                  setLeftSel({ variantId: null, quantity: 1 });
                  setRightSel({ variantId: null, quantity: 1 });
                }}
                className={`group overflow-hidden rounded-2xl border text-left transition ${
                  selected
                    ? 'border-brand-600 ring-2 ring-brand-600'
                    : 'border-gray-200 hover:border-brand-300'
                }`}
              >
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageSrc}
                    alt={l.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-transparent" />
                  {l.isNew && !selected && (
                    <span className="absolute left-2 top-2 rounded-full bg-pink-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow">
                      NEW
                    </span>
                  )}
                  {l.colorHex && (
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
                </div>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-[10px] text-gray-400">
                    {l.replacementCycle} · {l.piecesPerBox}매
                  </span>
                  <span className="text-xs font-bold text-brand-700">{formatKRW(l.price)}</span>
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
              <p className="mt-3 text-sm font-medium text-gray-600">조건에 맞는 제품이 없습니다</p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setTypeKey('all');
                  setBrand('');
                }}
                className="mt-3 rounded-full bg-gray-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-gray-700"
              >
                필터 초기화
              </button>
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
      </section>

      {/* 2. 도수 선택 (좌/우) */}
      {selectedLens && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-700">2. 좌우 도수 입력</h2>
            <button
              type="button"
              onClick={() => setDoseModalOpen(true)}
              className="text-xs font-medium text-brand-700 underline hover:text-brand-800"
            >
              {savedDose.right || savedDose.left ? '도수 수정/관리' : '도수 등록'}
            </button>
          </div>

          {/* 등록된 도수 안내 */}
          {doseLoaded && (savedDose.right || savedDose.left) && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs">
              <div className="font-semibold text-emerald-800">
                ✓ 등록된 콘택트 도수가 자동 입력됩니다
                {savedDose.recordedAt && (
                  <span className="ml-1 font-normal text-emerald-700">
                    ({new Date(savedDose.recordedAt).toLocaleDateString('ko-KR')} 기준)
                  </span>
                )}
              </div>
              <div className="mt-1 space-y-0.5 text-emerald-700">
                <div>우(R): {eyeSummary(savedDose.right)}</div>
                <div>좌(L): {eyeSummary(savedDose.left)}</div>
              </div>
            </div>
          )}

          {/* 등록 도수 없음 안내 */}
          {doseLoaded && !savedDose.right && !savedDose.left && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              <span className="font-semibold">등록된 콘택트 도수가 없습니다.</span>{' '}
              <button
                type="button"
                onClick={() => setDoseModalOpen(true)}
                className="font-semibold underline hover:no-underline"
              >
                도수 등록하기 →
              </button>
            </div>
          )}

          {/* 제품 도수 미지원 경고 */}
          {mismatch.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
              ⚠ 선택한 제품 <span className="font-semibold">{selectedLens.name}</span>은(는){' '}
              <span className="font-semibold">{mismatch.join('·')} 도수</span>를 제공하지 않습니다.
              다른 제품을 선택하거나, 가능한 도수로 등록 도수를 조정해 주세요.
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <EyeSelector
              title="왼쪽 (Left, OS)"
              variants={selectedLens.variants}
              value={leftSel}
              onChange={setLeftSel}
            />
            <EyeSelector
              title="오른쪽 (Right, OD)"
              variants={selectedLens.variants}
              value={rightSel}
              onChange={setRightSel}
            />
          </div>
        </section>
      )}

      {/* 3. 픽업가맹점 */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">3. 픽업가맹점 선택</h2>

        {/* 광역시·도 필터 */}
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

        {/* 지역 선택 전엔 안내, 선택 시 해당 지역 매장 리스트 */}
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

      {/* 4. 결제 — 매장 결제 전용 */}
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

      {/* 합계 + 제출 — 모바일 하단 탭 위로 고정 / 데스크탑은 sticky */}
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

      {/* 도수 관리 모달 — 자식창 */}
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

function EyeSelector({
  title,
  variants,
  value,
  onChange,
}: {
  title: string;
  variants: LensVariant[];
  value: EyeSelection;
  onChange: (v: EyeSelection) => void;
}) {
  const [skipEye, setSkipEye] = useState(value.variantId == null);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="font-medium">{title}</div>
        <label className="text-xs text-gray-500">
          <input
            type="checkbox"
            checked={skipEye}
            onChange={(e) => {
              setSkipEye(e.target.checked);
              if (e.target.checked) onChange({ variantId: null, quantity: 1 });
            }}
            className="mr-1"
          />
          이 눈은 주문 안 함
        </label>
      </div>

      {!skipEye && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500">도수 선택 (SKU)</label>
            <select
              className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3"
              value={value.variantId ?? ''}
              onChange={(e) =>
                onChange({ ...value, variantId: e.target.value || null })
              }
            >
              <option value="">선택...</option>
              {variants
                .filter((v) => v.available > 0)
                .map((v) => (
                  <option key={v.variantId} value={v.variantId}>
                    S {formatSign(v.sphere)}
                    {v.cylinder && Number(v.cylinder) !== 0
                      ? ` / C ${formatSign(v.cylinder)} / Ax ${v.axis ?? ''}`
                      : ''}
                    {' '}— 재고 {v.available}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">수량 (박스)</label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={20}
              value={value.quantity}
              onChange={(e) =>
                onChange({ ...value, quantity: Math.max(1, Number(e.target.value)) })
              }
              className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function formatSign(v: string | null): string {
  if (v == null) return '-';
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  return (n >= 0 ? '+' : '') + n.toFixed(2);
}

/** 저장된 도수가 제품 variants 에 존재하는지 매칭 (SPH/CYL/AXIS/ADD). */
function matchVariant(variants: LensVariant[], dose: EyeData): LensVariant | null {
  const targetSph = Number(dose.sphere);
  const targetCyl = dose.cylinder != null ? Number(dose.cylinder) : null;
  const targetAxis = dose.axis;
  const targetAdd = dose.addPower != null ? Number(dose.addPower) : null;
  return (
    variants.find((v) => {
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

function eyeSummary(eye: EyeData | null): string {
  if (!eye) return '-';
  const parts = [`SPH ${formatSign(eye.sphere)}`];
  if (eye.cylinder) parts.push(`CYL ${formatSign(eye.cylinder)}`);
  if (eye.axis !== null) parts.push(`AXIS ${eye.axis}`);
  if (eye.addPower) parts.push(`ADD ${formatSign(eye.addPower)}`);
  return parts.join(' · ');
}
