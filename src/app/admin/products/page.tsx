'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader, PageWrap } from '@/components/admin/page-header';
import { ProductExcelTools } from '@/components/admin/product-excel-tools';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  IconBox,
  IconEdit,
  IconList,
  IconPlus,
  IconSearch,
} from '@/components/ui/icons';
import { SkeletonCard } from '@/components/ui/skeleton';

interface LensRow {
  id: string;
  productCode: string;
  brand: string;
  name: string;
  lensType: string;
  replacementCycle: string;
  piecesPerBox: number;
  price: number;
  baseCurve: string | null;
  seriesCode: string | null;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

const LENS_TYPE_LABEL: Record<string, string> = {
  spherical: '구면',
  toric: '토릭',
  multifocal: '멀티포컬',
  color: '컬러',
  circle: '써클',
};

const CYCLE_LABEL: Record<string, string> = {
  '1day': '원데이',
  '2week': '2주',
  '1month': '1개월',
  '3month': '3개월',
  '6month': '6개월',
  '1year': '1년',
};

type SortKey = 'brand' | 'name' | 'productCode' | 'price' | 'createdAt';
type SortDir = 'asc' | 'desc';
type ViewMode = 'table' | 'card';

const PAGE_SIZE = 50;

export default function AdminProductsPage() {
  const [items, setItems] = useState<LensRow[] | null>(null);
  const [brandMap, setBrandMap] = useState<Record<string, string>>({});
  const [q, setQ] = useState('');
  const [brands, setBrands] = useState<Set<string>>(new Set());
  const [types, setTypes] = useState<Set<string>>(new Set());
  const [cycles, setCycles] = useState<Set<string>>(new Set());
  const [packs, setPacks] = useState<Set<number>>(new Set());
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [priceFilter, setPriceFilter] = useState<'all' | 'unset' | 'set'>('all');
  const [showFilters, setShowFilters] = useState(true);
  const [view, setView] = useState<ViewMode>('table');
  const [sortKey, setSortKey] = useState<SortKey>('brand');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [bulkBusy, setBulkBusy] = useState(false);

  const loadItems = () => {
    fetch('/api/admin/lenses', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setItems(j.lenses ?? []));
  };

  useEffect(() => {
    loadItems();
    fetch('/api/admin/brands')
      .then((r) => r.json())
      .then((j) => {
        const map: Record<string, string> = {};
        (j.brands ?? []).forEach((b: { nameKo: string; nameEn: string }) => {
          map[b.nameKo] = b.nameEn;
        });
        setBrandMap(map);
      })
      .catch(() => {});
  }, []);

  async function bulkActivate() {
    const inactiveCount = items?.filter((it) => !it.isActive).length ?? 0;
    if (inactiveCount === 0) {
      alert('이미 모두 활성 상태입니다.');
      return;
    }
    if (!confirm(`비활성 제품 ${inactiveCount}개와 해당 도수를 모두 활성화합니다. 진행할까요?`)) return;
    setBulkBusy(true);
    try {
      const res = await fetch('/api/admin/lenses/bulk-activate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ activate: true, includeVariants: true }),
      });
      const j = await res.json();
      if (!res.ok) {
        alert('실패: ' + (j.error ?? j.detail ?? '알 수 없음'));
        return;
      }
      alert(`활성화 완료: 제품 ${j.updatedLenses}개 · 도수 ${j.updatedVariants}개`);
      loadItems();
    } finally {
      setBulkBusy(false);
    }
  }

  // 사용 가능한 필터 옵션 (실제 데이터에서 추출)
  const toBrandEn = (nameKo: string) => brandMap[nameKo] ?? nameKo;

  const availableBrands = useMemo(() => {
    if (!items) return [];
    const s = new Set<string>();
    items.forEach((it) => s.add(it.brand));
    return Array.from(s).sort((a, b) => toBrandEn(a).localeCompare(toBrandEn(b)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, brandMap]);

  const availableTypes = useMemo(() => {
    if (!items) return [];
    const s = new Set<string>();
    items.forEach((it) => s.add(it.lensType));
    return Array.from(s).sort();
  }, [items]);

  const availableCycles = useMemo(() => {
    if (!items) return [];
    const s = new Set<string>();
    items.forEach((it) => s.add(it.replacementCycle));
    return Array.from(s).sort();
  }, [items]);

  const availablePacks = useMemo(() => {
    if (!items) return [];
    const s = new Set<number>();
    items.forEach((it) => s.add(it.piecesPerBox));
    return Array.from(s).sort((a, b) => a - b);
  }, [items]);

  // 필터 적용
  const filtered = useMemo(() => {
    if (!items) return null;
    const qLower = q.trim().toLowerCase();
    return items.filter((it) => {
      if (qLower) {
        const match =
          it.brand.toLowerCase().includes(qLower) ||
          (brandMap[it.brand] ?? it.brand).toLowerCase().includes(qLower) ||
          it.name.toLowerCase().includes(qLower) ||
          it.productCode.toLowerCase().includes(qLower) ||
          (it.seriesCode?.toLowerCase().includes(qLower) ?? false);
        if (!match) return false;
      }
      if (brands.size > 0 && !brands.has(it.brand)) return false;
      if (types.size > 0 && !types.has(it.lensType)) return false;
      if (cycles.size > 0 && !cycles.has(it.replacementCycle)) return false;
      if (packs.size > 0 && !packs.has(it.piecesPerBox)) return false;
      if (activeFilter === 'active' && !it.isActive) return false;
      if (activeFilter === 'inactive' && it.isActive) return false;
      if (priceFilter === 'unset' && it.price > 0) return false;
      if (priceFilter === 'set' && it.price === 0) return false;
      return true;
    });
  }, [items, q, brands, types, cycles, packs, activeFilter, priceFilter, brandMap]);

  // 정렬
  const sorted = useMemo(() => {
    if (!filtered) return null;
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'brand') cmp = (brandMap[a.brand] ?? a.brand).localeCompare(brandMap[b.brand] ?? b.brand) || a.name.localeCompare(b.name);
      else if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'productCode') cmp = a.productCode.localeCompare(b.productCode);
      else if (sortKey === 'price') cmp = a.price - b.price;
      else if (sortKey === 'createdAt') cmp = a.createdAt.localeCompare(b.createdAt);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir, brandMap]);

  // 페이지네이션
  const totalPages = sorted ? Math.max(1, Math.ceil(sorted.length / PAGE_SIZE)) : 1;
  const paged = useMemo(() => {
    if (!sorted) return null;
    const start = (page - 1) * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [sorted, page]);

  // 필터 변경 시 1페이지로
  useEffect(() => {
    setPage(1);
  }, [q, brands, types, cycles, packs, activeFilter, priceFilter, sortKey, sortDir]);

  // 통계
  const stats = useMemo(() => {
    if (!items) return null;
    return {
      total: items.length,
      active: items.filter((it) => it.isActive).length,
      inactive: items.filter((it) => !it.isActive).length,
      noPrice: items.filter((it) => it.price === 0).length,
    };
  }, [items]);

  const activeFilterCount =
    brands.size +
    types.size +
    cycles.size +
    packs.size +
    (activeFilter !== 'all' ? 1 : 0) +
    (priceFilter !== 'all' ? 1 : 0);

  function clearFilters() {
    setBrands(new Set());
    setTypes(new Set());
    setCycles(new Set());
    setPacks(new Set());
    setActiveFilter('all');
    setPriceFilter('all');
    setQ('');
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  return (
    <PageWrap>
      <PageHeader
        title="제품 마스터"
        description="콘택트렌즈 제품군을 등록하고 관리합니다. 도수별 SKU 는 제품별 상세에서 관리합니다."
        actions={
          <div className="flex gap-2">
            {stats && stats.inactive > 0 && (
              <Button
                variant="secondary"
                className="gap-1.5"
                disabled={bulkBusy}
                onClick={bulkActivate}
              >
                {bulkBusy ? '처리 중...' : `비활성 ${stats.inactive}개 일괄 활성화`}
              </Button>
            )}
            <Link href="/admin/products/new">
              <Button className="gap-1.5">
                <IconPlus size={16} />
                새 제품 등록
              </Button>
            </Link>
          </div>
        }
      />

      <ProductExcelTools
        brandOptions={[...new Set((items ?? []).map((i) => i.brand))].filter(Boolean).sort()}
      />

      {/* 통계 헤더 */}
      {stats && (
        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          <StatCard label="전체" value={stats.total} />
          <StatCard label="활성" value={stats.active} accent="text-emerald-600" />
          <StatCard label="비활성" value={stats.inactive} accent="text-gray-500" />
          <StatCard
            label="가격 미설정"
            value={stats.noPrice}
            accent={stats.noPrice > 0 ? 'text-amber-600' : 'text-gray-500'}
            hint="₩0"
          />
        </div>
      )}

      {/* 검색바 + 토글 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 min-w-[280px]">
          <IconSearch size={18} className="text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="브랜드, 제품명, 코드, 시리즈로 검색"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              지우기
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className={`relative rounded-xl border px-3 py-2 text-sm transition ${
            showFilters
              ? 'border-brand-300 bg-brand-50 text-brand-700'
              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          필터 {showFilters ? '닫기' : '열기'}
          {activeFilterCount > 0 && (
            <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[10px] font-medium text-white">
              {activeFilterCount}
            </span>
          )}
        </button>

        <div className="flex rounded-xl border border-gray-200 bg-white p-0.5">
          <button
            type="button"
            onClick={() => setView('table')}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              view === 'table' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
            title="테이블 뷰"
          >
            <IconList size={16} />
          </button>
          <button
            type="button"
            onClick={() => setView('card')}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              view === 'card' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
            title="카드 뷰"
          >
            <IconBox size={16} />
          </button>
        </div>
      </div>

      {/* 필터 패널 */}
      {showFilters && items && (
        <div className="mb-3 space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <FilterRow label="브랜드">
            {availableBrands.map((b) => (
              <Chip
                key={b}
                active={brands.has(b)}
                onClick={() => {
                  const s = new Set(brands);
                  s.has(b) ? s.delete(b) : s.add(b);
                  setBrands(s);
                }}
              >
                {toBrandEn(b)}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="렌즈 타입">
            {availableTypes.map((t) => (
              <Chip
                key={t}
                active={types.has(t)}
                onClick={() => {
                  const s = new Set(types);
                  s.has(t) ? s.delete(t) : s.add(t);
                  setTypes(s);
                }}
              >
                {LENS_TYPE_LABEL[t] ?? t}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="교체 주기">
            {availableCycles.map((c) => (
              <Chip
                key={c}
                active={cycles.has(c)}
                onClick={() => {
                  const s = new Set(cycles);
                  s.has(c) ? s.delete(c) : s.add(c);
                  setCycles(s);
                }}
              >
                {CYCLE_LABEL[c] ?? c}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="팩 사이즈">
            {availablePacks.map((p) => (
              <Chip
                key={p}
                active={packs.has(p)}
                onClick={() => {
                  const s = new Set(packs);
                  s.has(p) ? s.delete(p) : s.add(p);
                  setPacks(s);
                }}
              >
                {p}P
              </Chip>
            ))}
          </FilterRow>
          <div className="flex flex-wrap items-center gap-4 pt-1">
            <FilterRow label="활성" inline>
              {(['all', 'active', 'inactive'] as const).map((v) => (
                <Chip key={v} active={activeFilter === v} onClick={() => setActiveFilter(v)}>
                  {v === 'all' ? '전체' : v === 'active' ? '활성' : '비활성'}
                </Chip>
              ))}
            </FilterRow>
            <FilterRow label="가격" inline>
              {(['all', 'unset', 'set'] as const).map((v) => (
                <Chip key={v} active={priceFilter === v} onClick={() => setPriceFilter(v)}>
                  {v === 'all' ? '전체' : v === 'unset' ? '미설정' : '설정 완료'}
                </Chip>
              ))}
            </FilterRow>
          </div>
          {activeFilterCount > 0 && (
            <div className="flex justify-end border-t border-gray-100 pt-2">
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-gray-500 hover:text-gray-900"
              >
                필터 모두 지우기
              </button>
            </div>
          )}
        </div>
      )}

      {/* 결과 카운트 */}
      {items && (
        <div className="mb-2 text-xs text-gray-500">
          {sorted?.length === items.length
            ? `${items.length}개 제품`
            : `${sorted?.length ?? 0}개 / 전체 ${items.length}개 (필터 적용)`}
        </div>
      )}

      {/* 본문 */}
      {items === null ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<IconBox size={28} />}
          title="아직 등록된 제품이 없습니다"
          description="첫 콘택트렌즈 제품을 등록해보세요."
          action={
            <Link href="/admin/products/new">
              <Button className="gap-1.5">
                <IconPlus size={16} />첫 제품 등록하기
              </Button>
            </Link>
          }
        />
      ) : !paged || paged.length === 0 ? (
        <EmptyState
          icon={<IconSearch size={28} />}
          title="검색 결과가 없습니다"
          description="조건을 변경하거나 필터를 지워보세요."
          action={
            activeFilterCount > 0 || q ? (
              <Button onClick={clearFilters} variant="secondary">
                필터 지우기
              </Button>
            ) : undefined
          }
        />
      ) : view === 'table' ? (
        <ProductTable
          rows={paged}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={toggleSort}
          toBrandEn={toBrandEn}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {paged.map((it) => (
            <ProductCard key={it.id} item={it} brandEn={toBrandEn(it.brand)} />
          ))}
        </div>
      )}

      {/* 페이지네이션 */}
      {sorted && sorted.length > PAGE_SIZE && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPage={(p) => {
            setPage(p);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}
    </PageWrap>
  );
}

// ============================================================
// Sub-components
// ============================================================

function StatCard({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: number;
  accent?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-gray-500">{label}</span>
        {hint && <span className="text-[10px] text-gray-400">{hint}</span>}
      </div>
      <div className={`mt-0.5 text-2xl font-bold ${accent ?? 'text-gray-900'}`}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function FilterRow({
  label,
  inline,
  children,
}: {
  label: string;
  inline?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex ${inline ? 'items-center' : 'items-start'} gap-2`}>
      <div className={`${inline ? 'shrink-0' : 'w-20 shrink-0 pt-1'} text-xs font-medium text-gray-600`}>
        {label}
      </div>
      <div className="flex flex-1 flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-xs transition ${
        active
          ? 'bg-brand-600 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

function SortHeader({
  label,
  sortKey,
  current,
  dir,
  onClick,
  align,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const isActive = current === sortKey;
  return (
    <th
      onClick={() => onClick(sortKey)}
      className={`cursor-pointer select-none px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && <span className="text-gray-400">{dir === 'asc' ? '▲' : '▼'}</span>}
      </span>
    </th>
  );
}

function ProductTable({
  rows,
  sortKey,
  sortDir,
  onSort,
  toBrandEn,
}: {
  rows: LensRow[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  toBrandEn: (nameKo: string) => string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-200 bg-gray-50">
          <tr>
            <th className="w-12 px-2 py-2"></th>
            <SortHeader label="브랜드" sortKey="brand" current={sortKey} dir={sortDir} onClick={onSort} />
            <SortHeader label="제품명" sortKey="name" current={sortKey} dir={sortDir} onClick={onSort} />
            <SortHeader label="코드" sortKey="productCode" current={sortKey} dir={sortDir} onClick={onSort} />
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">타입</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">주기</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">팩</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">BC</th>
            <SortHeader label="가격" sortKey="price" current={sortKey} dir={sortDir} onClick={onSort} align="right" />
            <th className="px-3 py-2 text-center text-xs font-medium text-gray-600">상태</th>
            <th className="w-12 px-2 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((it) => (
            <tr key={it.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
              <td className="px-2 py-2">
                <div className="h-10 w-10 overflow-hidden rounded-lg bg-gray-100">
                  {it.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-gray-300">
                      <IconBox size={16} />
                    </div>
                  )}
                </div>
              </td>
              <td className="px-3 py-2 text-xs text-gray-700">{toBrandEn(it.brand)}</td>
              <td className="px-3 py-2">
                <Link href={`/admin/products/${it.id}`} className="font-medium text-gray-900 hover:text-brand-600">
                  {it.name}
                </Link>
              </td>
              <td className="px-3 py-2">
                <code className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-700">
                  {it.productCode}
                </code>
              </td>
              <td className="px-3 py-2 text-xs">
                <TypeBadge type={it.lensType} />
              </td>
              <td className="px-3 py-2 text-xs text-gray-600">
                {CYCLE_LABEL[it.replacementCycle] ?? it.replacementCycle}
              </td>
              <td className="px-3 py-2 text-right text-xs text-gray-600">{it.piecesPerBox}P</td>
              <td className="px-3 py-2 text-right text-xs text-gray-500">
                {it.baseCurve ? Number(it.baseCurve).toFixed(1) : '-'}
              </td>
              <td className="px-3 py-2 text-right">
                {it.price > 0 ? (
                  <span className="font-medium text-gray-900">₩{it.price.toLocaleString()}</span>
                ) : (
                  <span className="text-[11px] text-amber-600">미설정</span>
                )}
              </td>
              <td className="px-3 py-2 text-center">
                <span
                  className={`inline-flex h-1.5 w-1.5 rounded-full ${
                    it.isActive ? 'bg-emerald-500' : 'bg-gray-300'
                  }`}
                  title={it.isActive ? '활성' : '비활성'}
                />
              </td>
              <td className="px-2 py-2 text-right">
                <Link
                  href={`/admin/products/${it.id}`}
                  className="text-gray-400 hover:text-brand-600"
                  title="편집"
                >
                  <IconEdit size={14} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const cls: Record<string, string> = {
    spherical: 'bg-slate-100 text-slate-700',
    toric: 'bg-purple-100 text-purple-700',
    multifocal: 'bg-amber-100 text-amber-700',
    color: 'bg-pink-100 text-pink-700',
    circle: 'bg-rose-100 text-rose-700',
  };
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
        cls[type] ?? 'bg-gray-100 text-gray-700'
      }`}
    >
      {LENS_TYPE_LABEL[type] ?? type}
    </span>
  );
}

function ProductCard({ item, brandEn }: { item: LensRow; brandEn: string }) {
  return (
    <Link
      href={`/admin/products/${item.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:border-brand-200 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] w-full bg-gray-50">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-gray-300">
            <IconBox size={36} />
          </div>
        )}
        {!item.isActive && (
          <span className="absolute left-2 top-2 rounded bg-gray-900/80 px-2 py-0.5 text-[11px] font-medium text-white">
            비활성
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">
            {brandEn}
          </span>
          <TypeBadge type={item.lensType} />
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
            {CYCLE_LABEL[item.replacementCycle] ?? item.replacementCycle}
          </span>
        </div>
        <div className="text-sm font-semibold text-gray-900">{item.name}</div>
        <div className="text-[11px] text-gray-500">
          코드: {item.productCode} · {item.piecesPerBox}매입
        </div>
        <div className="mt-auto flex items-end justify-between pt-2">
          <div className="text-base font-bold text-gray-900">
            {item.price > 0 ? `₩${item.price.toLocaleString()}` : (
              <span className="text-xs text-amber-600">가격 미설정</span>
            )}
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-gray-400 group-hover:text-brand-600">
            <IconEdit size={12} /> 편집
          </span>
        </div>
      </div>
    </Link>
  );
}

function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) {
  // 표시할 페이지 번호 (현재 page 주변 ±2)
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="mt-4 flex items-center justify-center gap-1">
      <button
        type="button"
        disabled={page === 1}
        onClick={() => onPage(page - 1)}
        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"
      >
        이전
      </button>
      {start > 1 && (
        <>
          <button
            type="button"
            onClick={() => onPage(1)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            1
          </button>
          {start > 2 && <span className="px-1 text-gray-400">…</span>}
        </>
      )}
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPage(p)}
          className={`rounded-lg border px-3 py-1.5 text-sm ${
            p === page
              ? 'border-brand-600 bg-brand-600 text-white'
              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          {p}
        </button>
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="px-1 text-gray-400">…</span>}
          <button
            type="button"
            onClick={() => onPage(totalPages)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            {totalPages}
          </button>
        </>
      )}
      <button
        type="button"
        disabled={page === totalPages}
        onClick={() => onPage(page + 1)}
        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"
      >
        다음
      </button>
    </div>
  );
}
