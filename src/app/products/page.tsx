'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ShopHeaderNav } from '@/components/shop/shop-header-nav';

interface LensItem {
  id: string;
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
  colorPreviewUrl: string | null;
  seriesCode: string | null;
  isNew: boolean;
  diameter: string | null;
}

const CYCLE_LABEL: Record<string, string> = {
  '1day': '원데이',
  '2week': '2주교체',
  '1month': '1개월',
  '3month': '3개월',
  '6month': '6개월',
  '1year': '연간',
};

type TypeKey = 'all' | 'color' | '1day' | 'extended' | 'toric' | 'multifocal';

const TYPE_TABS: { key: TypeKey; label: string }[] = [
  { key: 'all',        label: '전체' },
  { key: 'color',      label: '컬러렌즈' },
  { key: '1day',       label: '원데이' },
  { key: 'extended',   label: '장기착용' },
  { key: 'toric',      label: '난시용' },
  { key: 'multifocal', label: '다초점' },
];

type ColorFamily = 'brown' | 'black' | 'gray' | 'blue' | 'hazel' | 'gold';

const COLOR_FAMILIES: { key: ColorFamily; label: string; hex: string }[] = [
  { key: 'brown', label: '브라운', hex: '#8B5E3C' },
  { key: 'black', label: '블랙',   hex: '#1A1A1A' },
  { key: 'gray',  label: '그레이', hex: '#808080' },
  { key: 'blue',  label: '블루',   hex: '#4169E1' },
  { key: 'hazel', label: '헤이즐', hex: '#8B6914' },
  { key: 'gold',  label: '골드',   hex: '#D4A820' },
];

function colorFamilyOf(lens: LensItem): ColorFamily | null {
  const name = lens.colorName ?? '';
  if (/헤이즐/.test(name)) return 'hazel';
  if (/(골드|글리터|쉬머링)/.test(name)) return 'gold';
  if (/(블루|문)/.test(name)) return 'blue';
  if (/(그레이|스모크)/.test(name)) return 'gray';
  if (/(블랙|째즈|이터널|퓨어 블랙|스파클링)/.test(name)) return 'black';
  if (/(브라운|초코|카라멜|모카|메이플|허니|뮤즈|밤비|디어|시크|크리스탈|랩소디|라틴|로즈|메리|멜로우|트윙클|소울|수지|에스텔|알리샤|헤일로 브라운)/.test(name)) return 'brown';
  return null;
}

function isColored(l: LensItem) {
  return l.lensType === 'color' || l.lensType === 'circle';
}

function matchesType(l: LensItem, key: TypeKey) {
  if (key === 'all') return true;
  if (key === 'color') return isColored(l);
  if (key === '1day') return l.replacementCycle === '1day' && !isColored(l);
  if (key === 'extended') return l.replacementCycle !== '1day' && !isColored(l) && l.lensType !== 'multifocal';
  if (key === 'toric') return l.lensType === 'toric';
  if (key === 'multifocal') return l.lensType === 'multifocal';
  return true;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <ProductsInner />
    </Suspense>
  );
}

function ProductsInner() {
  const params = useSearchParams();
  const [all, setAll] = useState<LensItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState(() => params.get('brand') ?? '');
  const [type, setType] = useState<TypeKey>(
    (params.get('type') as TypeKey | null) ?? 'all',
  );
  const [colorFam, setColorFam] = useState<ColorFamily | null>(null);
  const [query, setQuery] = useState('');
  const [shuffleNonce, setShuffleNonce] = useState(0);

  useEffect(() => {
    fetch('/api/catalog')
      .then((r) => r.json())
      .then((j) => setAll(j.lenses ?? []))
      .finally(() => setLoading(false));
  }, []);

  const brands = useMemo(
    () => [...new Set(all.map((l) => l.brand))].sort(),
    [all],
  );

  // Random featured pick — refreshes on shuffle button click
  const featuredPick = useMemo(() => {
    if (all.length === 0) return null;
    const candidates = all.filter((l) => isColored(l) && (l.colorHex || l.imageUrl));
    const pool = candidates.length > 0 ? candidates : all;
    return shuffle(pool)[0];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, shuffleNonce]);

  const todayPicks = useMemo(() => {
    if (all.length === 0) return [];
    const pool = all.filter((l) => l.id !== featuredPick?.id);
    return shuffle(pool).slice(0, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, featuredPick, shuffleNonce]);

  const newArrivals = useMemo(
    () => all.filter((l) => l.isNew),
    [all],
  );

  const display = useMemo(() => {
    let list = all;
    if (brand) list = list.filter((l) => l.brand === brand);
    list = list.filter((l) => matchesType(l, type));
    if (colorFam) list = list.filter((l) => colorFamilyOf(l) === colorFam);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((l) =>
        l.name.toLowerCase().includes(q) ||
        l.brand.toLowerCase().includes(q) ||
        (l.colorName ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [all, brand, type, colorFam, query]);

  const colorCount = useMemo(() => all.filter(isColored).length, [all]);

  const resetFilters = () => {
    setBrand('');
    setType('all');
    setColorFam(null);
    setQuery('');
  };

  const hasFilter = Boolean(brand || type !== 'all' || colorFam || query.trim());

  return (
    <div className="min-h-screen bg-white">
      {/* ── Header ─────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between gap-3 px-4 py-2 md:px-8 md:py-2.5">
          <Link href="/" className="text-base font-bold tracking-tight text-gray-900 hover:opacity-70 transition-opacity md:text-lg">
            Funnyview Pickup
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/products" className="hidden text-sm font-semibold text-gray-900 underline underline-offset-4 md:inline">
              렌즈
            </Link>
            <Link href="/stores" className="hidden text-sm text-gray-500 hover:text-gray-900 transition-colors md:inline">
              매장찾기
            </Link>
            <Link
              href="/customer/order"
              className="hidden rounded-full bg-gray-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 transition-colors md:block"
            >
              주문하기
            </Link>
            <ShopHeaderNav />
          </div>
        </div>
      </header>

      {/* ── Page hero with search ──────────────────────── */}
      <section className="border-b border-gray-100 px-4 pb-8 pt-10 md:px-8 md:pb-10 md:pt-14">
        <div className="mx-auto max-w-screen-xl">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
            Contact Lens Boutique
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-gray-900 md:text-6xl">
            오늘 어떤 렌즈를<br className="md:hidden" /> 찾으세요?
          </h1>

          <div className="mt-6 max-w-xl">
            <div className="relative">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                <circle cx="11" cy="11" r="7"/>
                <path d="m21 21-4.3-4.3"/>
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="제품명, 브랜드, 컬러로 검색"
                className="w-full rounded-full border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm placeholder-gray-400 focus:border-gray-900 focus:outline-none transition-colors"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  aria-label="검색 지우기"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {!loading && (
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500">
              <span>총 <strong className="text-gray-900">{all.length}</strong>가지 제품</span>
              <span>컬러렌즈 <strong className="text-gray-900">{colorCount}</strong>종</span>
              <span>브랜드 <strong className="text-gray-900">{brands.length}</strong>개</span>
            </div>
          )}
        </div>
      </section>

      {/* ── FUNNYVIEW PICK (random hero) ──────────────── */}
      {!loading && featuredPick && !hasFilter && (
        <section className="px-4 py-8 md:px-8 md:py-12">
          <div className="mx-auto max-w-screen-xl">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                  🎲 Funnyview Pick
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-gray-900 md:text-3xl">
                  지금 이 렌즈
                </h2>
              </div>
              <button
                onClick={() => setShuffleNonce((n) => n + 1)}
                className="rounded-full border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-900 hover:text-gray-900 transition-colors"
              >
                다시 추천받기 ↻
              </button>
            </div>
            <FeaturedHero lens={featuredPick} />
          </div>
        </section>
      )}

      {/* ── Today's picks (horizontal scroll) ─────────── */}
      {!loading && todayPicks.length > 0 && !hasFilter && (
        <section className="border-t border-gray-100 px-4 py-8 md:px-8 md:py-10">
          <div className="mx-auto max-w-screen-xl">
            <div className="mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                {"✦ Today's Picks"}
              </p>
              <h2 className="mt-1 text-xl font-bold text-gray-900 md:text-2xl">
                오늘의 추천 10종
              </h2>
            </div>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 md:-mx-8 md:px-8 pb-2">
              {todayPicks.map((lens) => (
                <div key={lens.id} className="w-[160px] shrink-0 md:w-[180px]">
                  <ShopCard lens={lens} compact />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Sticky filter bar ──────────────────────────── */}
      <div className="sticky top-[57px] z-20 border-y border-gray-100 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto max-w-screen-xl px-4 md:px-8">
          {/* Type pills */}
          <div className="flex gap-1.5 overflow-x-auto py-3 scrollbar-hide">
            {TYPE_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => { setType(t.key); if (t.key !== 'color') setColorFam(null); }}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                  type === t.key
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Brand chips */}
          <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
            <button
              onClick={() => setBrand('')}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                brand === ''
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-800'
              }`}
            >
              전체 브랜드
            </button>
            {brands.map((b) => (
              <button
                key={b}
                onClick={() => setBrand(brand === b ? '' : b)}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                  brand === b
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-800'
                }`}
              >
                {b}
              </button>
            ))}
          </div>

          {/* Color family chips */}
          {(type === 'color' || type === 'all') && (
            <div className="flex items-center gap-2 overflow-x-auto pb-3 scrollbar-hide">
              <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                컬러
              </span>
              {COLOR_FAMILIES.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setColorFam(colorFam === c.key ? null : c.key)}
                  className={`shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                    colorFam === c.key
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-200 text-gray-600 hover:border-gray-400'
                  }`}
                >
                  <span
                    className="h-3 w-3 rounded-full border border-white/30"
                    style={{
                      background: `radial-gradient(circle at 35% 35%, ${c.hex}40 0%, ${c.hex} 100%)`,
                    }}
                  />
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Result count ───────────────────────────────── */}
      {!loading && (
        <div className="mx-auto max-w-screen-xl px-4 pb-1 pt-5 md:px-8">
          <p className="text-xs text-gray-400">
            {display.length}개 제품
            {brand && ` · ${brand}`}
            {colorFam && ` · ${COLOR_FAMILIES.find((c) => c.key === colorFam)?.label}`}
            {query.trim() && ` · "${query.trim()}"`}
            {hasFilter && (
              <button onClick={resetFilters} className="ml-3 text-gray-600 underline">
                필터 초기화
              </button>
            )}
          </p>
        </div>
      )}

      {/* ── Product grid ───────────────────────────────── */}
      <main className="mx-auto max-w-screen-xl px-4 py-4 pb-16 md:px-8">
        {loading ? (
          <SkeletonGrid />
        ) : display.length === 0 ? (
          <EmptyResult onReset={resetFilters} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {display.map((lens) => (
              <ShopCard key={lens.id} lens={lens} />
            ))}
          </div>
        )}
      </main>

      {/* ── NEW arrivals section ────────────────────────── */}
      {!loading && newArrivals.length > 0 && !hasFilter && (
        <section className="border-t border-gray-100 bg-gray-50 px-4 py-10 md:px-8 md:py-14">
          <div className="mx-auto max-w-screen-xl">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-pink-500">
                  💎 New In
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-gray-900 md:text-3xl">
                  2025 신상품
                </h2>
              </div>
              <span className="text-xs text-gray-400">{newArrivals.length}종</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
              {newArrivals.map((lens) => (
                <ShopCard key={lens.id} lens={lens} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA strip ──────────────────────────────────── */}
      <div className="border-t border-gray-100 bg-gray-900 px-4 py-12 text-center text-white">
        <p className="text-sm text-white/60">원하는 렌즈를 찾으셨나요?</p>
        <h2 className="mt-2 text-2xl font-bold">가까운 매장에서 바로 픽업</h2>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            href="/customer/order"
            className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-100 transition-colors"
          >
            지금 주문하기
          </Link>
          <Link
            href="/stores"
            className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
          >
            매장 찾기
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ── Featured hero (one large card) ─────────────────── */
function FeaturedHero({ lens }: { lens: LensItem }) {
  const imageSrc = lens.imageUrl ?? `/api/lens-image/${lens.productCode}`;
  const cycle = CYCLE_LABEL[lens.replacementCycle] ?? lens.replacementCycle;

  return (
    <Link
      href={`/products/${lens.productCode}`}
      className="group block overflow-hidden rounded-3xl bg-gray-900 transition-all hover:shadow-2xl"
    >
      <div className="grid grid-cols-1 md:grid-cols-5">
        <div className="relative aspect-square md:col-span-3 md:aspect-auto overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc}
            alt={lens.name}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
            loading="lazy"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent md:to-black/40" />
        </div>
        <div className="flex flex-col justify-center gap-4 px-6 py-8 text-white md:col-span-2 md:px-10">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/50">
            {lens.brand}
          </p>
          <h3 className="text-3xl font-black leading-tight tracking-tight md:text-4xl">
            {lens.name}
          </h3>
          {lens.colorName && (
            <p className="text-sm text-white/70">{lens.colorName}</p>
          )}
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full bg-white/10 px-3 py-1 text-white/80">{cycle}</span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-white/80">{lens.piecesPerBox}매입</span>
            {lens.isNew && (
              <span className="rounded-full bg-pink-500 px-3 py-1 font-bold text-white">NEW</span>
            )}
          </div>
          <div className="mt-2 flex items-baseline justify-between border-t border-white/15 pt-4">
            <span className="text-xs text-white/50">픽업 매장 가격</span>
            <span className="text-2xl font-bold">
              {lens.price === 0 ? <span className="text-base text-white/60">가격문의</span> : `${lens.price.toLocaleString()}원`}
            </span>
          </div>
          <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-white group-hover:gap-2 transition-all">
            바로 주문하기 →
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ── Shop Card ─────────────────────────────────────────── */
function ShopCard({ lens, compact }: { lens: LensItem; compact?: boolean }) {
  const [liked, setLiked] = useState(false);
  const cycleLabel = CYCLE_LABEL[lens.replacementCycle] ?? lens.replacementCycle;
  const colored = isColored(lens);
  const imageSrc = lens.imageUrl ?? `/api/lens-image/${lens.productCode}`;

  return (
    <Link
      href={`/products/${lens.productCode}`}
      className="group block overflow-hidden rounded-2xl bg-gray-50 transition-all hover:shadow-xl hover:-translate-y-0.5"
    >
      <div className={`relative overflow-hidden bg-gray-100 ${compact ? 'aspect-square' : 'aspect-[3/4]'}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={lens.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
          loading="lazy"
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" />

        <button
          type="button"
          aria-label="찜하기"
          onClick={(e) => { e.preventDefault(); setLiked((v) => !v); }}
          className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full bg-black/20 backdrop-blur-sm transition hover:bg-black/40"
        >
          <svg width="16" height="16" viewBox="0 0 24 24"
            fill={liked ? '#ff4e7c' : 'none'}
            stroke={liked ? '#ff4e7c' : 'white'}
            strokeWidth="2"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

        {lens.isNew && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-pink-500 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white shadow">
            NEW
          </span>
        )}

        {colored && (lens.colorHex || lens.colorPreviewUrl) && (
          <div className="absolute bottom-10 right-2.5">
            {lens.colorPreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lens.colorPreviewUrl}
                alt={lens.colorName ?? ''}
                className="h-8 w-8 rounded-full border-2 border-white object-cover shadow-md"
              />
            ) : (
              <div
                className="h-8 w-8 rounded-full border-2 border-white shadow-md"
                style={{
                  background: `radial-gradient(circle at 35% 35%, ${lens.colorHex}40 0%, ${lens.colorHex}99 55%, ${lens.colorHex} 100%)`,
                }}
              />
            )}
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 text-white">
          <p className="truncate text-[10px] font-medium opacity-60">{lens.brand}</p>
          <h3 className={`font-semibold leading-tight line-clamp-2 ${compact ? 'text-xs' : 'text-sm'}`}>
            {lens.name}
          </h3>
          {lens.colorName && !compact && (
            <p className="mt-0.5 text-[10px] opacity-75">{lens.colorName}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="text-[11px] text-gray-400">{cycleLabel}</span>
        <span className={`font-bold text-gray-900 ${compact ? 'text-xs' : 'text-sm'}`}>
          {lens.price === 0 ? <span className="text-gray-400 font-normal">가격문의</span> : `${lens.price.toLocaleString()}원`}
        </span>
      </div>
    </Link>
  );
}

/* ── Skeleton grid ─────────────────────────────────────── */
function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 15 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl bg-gray-100 animate-pulse">
          <div className="aspect-[3/4]" />
          <div className="px-3 py-2.5">
            <div className="h-3 w-2/3 rounded bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Empty result ──────────────────────────────────────── */
function EmptyResult({ onReset }: { onReset: () => void }) {
  return (
    <div className="py-24 text-center">
      <p className="text-4xl">🔍</p>
      <p className="mt-4 text-lg font-semibold text-gray-700">조건에 맞는 제품이 없습니다</p>
      <p className="mt-1 text-sm text-gray-400">필터를 초기화하고 다시 시도해보세요</p>
      <button
        onClick={onReset}
        className="mt-6 rounded-full bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 transition-colors"
      >
        필터 초기화
      </button>
    </div>
  );
}
