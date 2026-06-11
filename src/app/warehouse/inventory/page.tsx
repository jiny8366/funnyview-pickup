'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  formatLensDisplayName,
  formatLensSpec,
  formatPackQuantity,
} from '@/lib/lens/format';

interface InvRow {
  inventoryId: string;
  variantId: string;
  sku: string;
  brand: string;
  lensName: string;
  sphere: string;
  cylinder: string | null;
  axis: number | null;
  addPower: string | null;
  replacementCycle: string;
  piecesPerBox: number;
  lensType: string;
  onHand: number;
  reserved: number;
  available: number;
  safetyStock: number;
  reorderPoint: number;
  isLow: boolean;
  lotCount: number;
  weightedAvgCost: number;
  oldestInboundDate: string | null;
}

const TYPE_OPTIONS = [
  { value: 'spherical', label: '구면(투명)' },
  { value: 'toric', label: '난시(토릭)' },
  { value: 'multifocal', label: '다초점' },
  { value: 'color', label: '컬러' },
];

// 교체주기 코드 → 한글 라벨 (어드민 제품마스터와 동일 표기)
const CYCLE_LABEL: Record<string, string> = {
  daily: '원데이',
  biweekly: '2주',
  monthly: '월간',
  quarterly: '분기',
  yearly: '장기',
};
const cycleLabel = (v: string) => CYCLE_LABEL[v] ?? v;

/** 다른 페이지(제품 목록 등)와 동일한 필터 칩. */
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-xs transition ${
        active ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-14 shrink-0 pt-1 text-xs font-medium text-gray-600">{label}</div>
      <div className="flex flex-1 flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export default function WarehouseInventoryPage() {
  return (
    <Suspense fallback={null}>
      <WarehouseInventoryInner />
    </Suspense>
  );
}

function WarehouseInventoryInner() {
  const params = useSearchParams();
  const lowDeepLink = params.get('low') === '1';

  // 검색우선 UX: 조건을 정하고 '조회'를 눌러야 로드 (44k행 자동로드 방지).
  const [q, setQ] = useState('');
  const [brands, setBrands] = useState<Set<string>>(new Set());
  const [types, setTypes] = useState<Set<string>>(new Set());
  const [allBrands, setAllBrands] = useState<string[]>([]);
  const [cycles, setCycles] = useState<Set<string>>(new Set());
  const [packs, setPacks] = useState<Set<number>>(new Set());
  const [allCycles, setAllCycles] = useState<string[]>([]);
  const [allPacks, setAllPacks] = useState<number[]>([]);
  const [lowOnly, setLowOnly] = useState(lowDeepLink);
  const [rows, setRows] = useState<InvRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [delta, setDelta] = useState('');

  const buildParams = useCallback(
    (forAll: boolean) => {
      const sp = new URLSearchParams();
      if (!forAll) {
        if (q.trim()) sp.set('q', q.trim());
        if (brands.size > 0) sp.set('brand', [...brands].join(','));
        if (types.size > 0) sp.set('type', [...types].join(','));
        if (cycles.size > 0) sp.set('cycle', [...cycles].join(','));
        if (packs.size > 0) sp.set('pack', [...packs].join(','));
        if (lowOnly) sp.set('low', '1');
      }
      return sp;
    },
    [q, brands, types, cycles, packs, lowOnly],
  );

  // 브랜드 칩 목록 (다른 페이지와 동일한 칩 토글 UX)
  useEffect(() => {
    fetch('/api/warehouse/inventory?facets=1')
      .then((r) => r.json())
      .then((j) => {
        setAllBrands(j.brands ?? []);
        setAllCycles(j.cycles ?? []);
        setAllPacks(j.packs ?? []);
      })
      .catch(() => {
        setAllBrands([]);
        setAllCycles([]);
        setAllPacks([]);
      });
  }, []);

  const load = useCallback(
    async (forAll = false) => {
      setLoading(true);
      setSearched(true);
      try {
        const sp = buildParams(forAll);
        const res = await fetch('/api/warehouse/inventory' + (sp.size ? '?' + sp.toString() : ''));
        const j = await res.json();
        setRows(j.inventory ?? []);
      } finally {
        setLoading(false);
      }
    },
    [buildParams],
  );

  // 대시보드 '저재고' 딥링크(?low=1)는 기존처럼 자동 조회
  useEffect(() => {
    if (lowDeepLink) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lowDeepLink]);

  function csvHref() {
    const sp = buildParams(false);
    sp.set('format', 'csv');
    return '/api/warehouse/inventory?' + sp.toString();
  }

  async function adjust(variantId: string) {
    const n = Number(delta);
    if (!Number.isInteger(n) || n === 0) return;
    await fetch('/api/warehouse/inventory', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ variantId, delta: n, note: n > 0 ? '입고' : '재고조정' }),
    });
    setEditing(null);
    setDelta('');
    load();
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold">재고 관리</h1>
      </header>

      {/* 검색 패널 */}
      <div className="space-y-2 rounded-2xl border border-gray-200 bg-white p-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="제품명 또는 SKU 검색"
            className="h-9 w-64 rounded-lg border border-gray-200 px-3 text-sm"
          />
          <label className="inline-flex items-center gap-1.5 text-sm text-gray-700">
            <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} className="h-4 w-4" />
            저재고만
          </label>
          <Button size="sm" onClick={() => load()} disabled={loading}>
            {loading ? '조회 중…' : '🔍 조회'}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => load(true)} disabled={loading}>
            전체 보기
          </Button>
        </div>
        {allBrands.length > 0 && (
          <FilterRow label="브랜드">
            {allBrands.map((b) => (
              <Chip
                key={b}
                active={brands.has(b)}
                onClick={() => {
                  const s = new Set(brands);
                  if (s.has(b)) s.delete(b);
                  else s.add(b);
                  setBrands(s);
                }}
              >
                {b}
              </Chip>
            ))}
          </FilterRow>
        )}
        <FilterRow label="렌즈 타입">
          {TYPE_OPTIONS.map((t) => (
            <Chip
              key={t.value}
              active={types.has(t.value)}
              onClick={() => {
                const s = new Set(types);
                if (s.has(t.value)) s.delete(t.value);
                else s.add(t.value);
                setTypes(s);
              }}
            >
              {t.label}
            </Chip>
          ))}
        </FilterRow>
        {allCycles.length > 0 && (
          <FilterRow label="주기">
            {allCycles.map((c) => (
              <Chip
                key={c}
                active={cycles.has(c)}
                onClick={() => {
                  const s = new Set(cycles);
                  if (s.has(c)) s.delete(c);
                  else s.add(c);
                  setCycles(s);
                }}
              >
                {cycleLabel(c)}
              </Chip>
            ))}
          </FilterRow>
        )}
        {allPacks.length > 0 && (
          <FilterRow label="갯수">
            {allPacks.map((p) => (
              <Chip
                key={p}
                active={packs.has(p)}
                onClick={() => {
                  const s = new Set(packs);
                  if (s.has(p)) s.delete(p);
                  else s.add(p);
                  setPacks(s);
                }}
              >
                {p}P
              </Chip>
            ))}
          </FilterRow>
        )}
        {searched && rows && (
          <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-2">
            <span className="text-xs text-gray-500">{rows.length.toLocaleString()}개 도수(SKU)</span>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              🖨 인쇄 · PDF
            </button>
            <a
              href={csvHref()}
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              ⬇ 엑셀 다운로드
            </a>
          </div>
        )}
      </div>

      {/* 인쇄 머리글 (인쇄물에만 표시) */}
      <div className="hidden print:block">
        <h2 className="text-lg font-bold">재고 현황</h2>
        <p className="text-xs text-gray-500">
          Funnyview Pickup · 출력일 {new Date().toLocaleString('ko-KR')}
          {q && ` · 검색어 "${q}"`}{brands.size > 0 && ` · 브랜드 ${[...brands].join('/')}`}{types.size > 0 && ` · 유형 ${types.size}종`}{lowOnly && ' · 저재고만'}
        </p>
      </div>

      {!searched ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center text-sm text-gray-400 print:hidden">
          검색 조건을 입력하고 <b>조회</b>를 누르세요. 전체 재고는 <b>전체 보기</b>로 확인할 수 있습니다.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white print:rounded-none print:border-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">제품 (브랜드 / 제품명 / 주기 / 팩수)</th>
                <th className="px-3 py-2 text-left">도수</th>
                <th className="px-3 py-2 text-right">현재고 (팩)</th>
                <th className="px-3 py-2 text-right">안전재고</th>
                <th className="px-3 py-2 text-right print:hidden">조정</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">불러오는 중...</td></tr>
              )}
              {!loading && rows?.map((r) => {
                const productName = formatLensDisplayName(
                  {
                    brand: r.brand,
                    name: r.lensName,
                    replacementCycle: r.replacementCycle,
                    piecesPerBox: r.piecesPerBox,
                    lensType: r.lensType,
                  },
                  { sku: r.sku, sphere: '0', cylinder: null, axis: null, addPower: null },
                  { format: 'full' },
                ).replace(/ \/ SPH \+0\.00$/, '');
                return (
                  <tr key={r.variantId} className={r.isLow ? 'bg-red-50' : ''}>
                    <td className="px-3 py-2">
                      <div>{productName}</div>
                      <div className="text-[10px] font-mono text-gray-400">{r.sku}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">{formatLensSpec(r) || '—'}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${r.isLow ? 'text-red-700' : ''}`}>
                      {r.onHand}<span className="ml-0.5 text-[10px] font-normal text-gray-400">팩</span>
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-gray-500">{r.safetyStock}</td>
                    <td className="px-3 py-2 text-right print:hidden">
                      {editing === r.variantId ? (
                        <div className="flex items-center justify-end gap-1">
                          <Input
                            className="w-20"
                            value={delta}
                            onChange={(e) => setDelta(e.target.value.replace(/[^\-0-9]/g, ''))}
                            inputMode="numeric"
                          />
                          <Button size="sm" onClick={() => adjust(r.variantId)}>
                            적용
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                            취소
                          </Button>
                        </div>
                      ) : (
                        <Button variant="secondary" size="sm" onClick={() => setEditing(r.variantId)}>
                          변경
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && rows && rows.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-10 text-center text-gray-400">조건에 맞는 재고가 없습니다</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
