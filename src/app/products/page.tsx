'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

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

const TYPE_TABS: { key: TypeKey; label: string; emoji: string }[] = [
  { key: 'all',       label: '전체',   emoji: '' },
  { key: 'color',     label: '컬러렌즈', emoji: '✦' },
  { key: '1day',      label: '원데이',  emoji: '' },
  { key: 'extended',  label: '장기착용', emoji: '' },
  { key: 'toric',     label: '난시용',  emoji: '' },
  { key: 'multifocal',label: '다초점',  emoji: '' },
];

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

export default function ProductsPage() {
  const params = useSearchParams();
  const [all, setAll] = useState<LensItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState('');
  const [type, setType] = useState<TypeKey>(
    (params.get('type') as TypeKey | null) ?? 'all',
  );

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

  const display = useMemo(() => {
    let list = brand ? all.filter((l) => l.brand === brand) : all;
    return list.filter((l) => matchesType(l, type));
  }, [all, brand, type]);

  const colorCount = useMemo(() => all.filter(isColored).length, [all]);

  return (
    <div className="min-h-screen bg-white">
      {/* ── Header ─────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between gap-3 px-4 py-3.5 md:px-8">
          <Link href="/" className="text-base font-bold tracking-tight text-gray-900 hover:opacity-70 transition-opacity">
            Funnyview Pickup
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/products" className="font-semibold text-gray-900 underline underline-offset-4">
              렌즈
            </Link>
            <Link href="/stores" className="text-gray-500 hover:text-gray-900 transition-colors">
              매장찾기
            </Link>
            <Link
              href="/customer/order"
              className="hidden rounded-full bg-gray-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 transition-colors md:block"
            >
              주문하기
            </Link>
            <Link
              href="/login"
              className="text-gray-500 hover:text-gray-900 transition-colors"
            >
              로그인
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Page hero ──────────────────────────────────── */}
      <section className="border-b border-gray-100 px-4 pb-8 pt-10 md:px-8 md:pb-12 md:pt-16">
        <div className="mx-auto max-w-screen-xl">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
            Contact Lens Boutique
          </p>
          <h1 className="mt-2 text-5xl font-black tracking-tight text-gray-900 md:text-7xl">
            렌즈 쇼핑
          </h1>
          {!loading && (
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500">
              <span>총 <strong className="text-gray-900">{all.length}</strong>가지 제품</span>
              <span>컬러렌즈 <strong className="text-gray-900">{colorCount}</strong>종</span>
              <span>브랜드 <strong className="text-gray-900">{brands.length}</strong>개</span>
            </div>
          )}
        </div>
      </section>

      {/* ── Sticky filter bar ──────────────────────────── */}
      <div className="sticky top-[57px] z-20 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto max-w-screen-xl px-4 md:px-8">
          {/* Type pills */}
          <div className="flex gap-1.5 overflow-x-auto py-3 scrollbar-hide">
            {TYPE_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setType(t.key)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                  type === t.key
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t.emoji ? `${t.emoji} ${t.label}` : t.label}
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
        </div>
      </div>

      {/* ── Result count ───────────────────────────────── */}
      {!loading && (
        <div className="mx-auto max-w-screen-xl px-4 pb-1 pt-5 md:px-8">
          <p className="text-xs text-gray-400">
            {display.length}개 제품 표시
            {brand && ` · ${brand}`}
          </p>
        </div>
      )}

      {/* ── Product grid ───────────────────────────────── */}
      <main className="mx-auto max-w-screen-xl px-4 py-4 pb-20 md:px-8">
        {loading ? (
          <SkeletonGrid />
        ) : display.length === 0 ? (
          <EmptyResult onReset={() => { setBrand(''); setType('all'); }} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {display.map((lens, i) => (
              <ShopCard key={lens.id} lens={lens} featured={i === 0 && type === 'all' && !brand} />
            ))}
          </div>
        )}
      </main>

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

/* ── Shop Card ─────────────────────────────────────────── */
function ShopCard({ lens, featured }: { lens: LensItem; featured?: boolean }) {
  const [liked, setLiked] = useState(false);
  const cycleLabel = CYCLE_LABEL[lens.replacementCycle] ?? lens.replacementCycle;
  const colored = isColored(lens);

  return (
    <Link
      href="/customer/order"
      className={`group block overflow-hidden rounded-2xl bg-gray-50 transition-all hover:shadow-xl hover:-translate-y-0.5 ${
        featured ? 'sm:col-span-2 sm:row-span-2' : ''
      }`}
    >
      {/* Image */}
      <div className={`relative overflow-hidden bg-gray-100 ${featured ? 'aspect-square sm:aspect-[4/3]' : 'aspect-[3/4]'}`}>
        {lens.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={lens.imageUrl}
            alt={lens.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
            loading="lazy"
          />
        ) : (
          <NoImagePlaceholder lens={lens} />
        )}

        {/* Gradient */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" />

        {/* Heart */}
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

        {/* NEW badge */}
        {lens.isNew && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-pink-500 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white shadow">
            NEW
          </span>
        )}

        {/* Color swatch */}
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

        {/* Text on gradient */}
        <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 text-white">
          <p className="truncate text-[10px] font-medium opacity-60">{lens.brand}</p>
          <h3 className={`font-semibold leading-tight line-clamp-2 ${featured ? 'text-base md:text-lg' : 'text-sm'}`}>
            {lens.name}
          </h3>
          {lens.colorName && (
            <p className="mt-0.5 text-[10px] opacity-75">{lens.colorName}</p>
          )}
        </div>
      </div>

      {/* Price strip */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="text-[11px] text-gray-400">{cycleLabel}</span>
        <span className="text-sm font-bold text-gray-900">
          {lens.price === 0 ? <span className="text-gray-400 font-normal">가격문의</span> : `${lens.price.toLocaleString()}원`}
        </span>
      </div>
    </Link>
  );
}

/* ── No-image placeholder ──────────────────────────────── */
function NoImagePlaceholder({ lens }: { lens: LensItem }) {
  const colored = isColored(lens);
  if (colored && lens.colorHex) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
        <div
          className="relative h-28 w-28 rounded-full shadow-2xl ring-4 ring-white/10"
          style={{
            background: `radial-gradient(circle at 35% 35%, ${lens.colorHex}30 0%, ${lens.colorHex}cc 60%, ${lens.colorHex} 100%)`,
          }}
        >
          <div className="absolute inset-0 m-auto h-10 w-10 rounded-full bg-black/40" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200">
      <div className="h-24 w-24 rounded-full border-[3px] border-gray-300 opacity-40" />
    </div>
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
