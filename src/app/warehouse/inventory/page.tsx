'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { InlineNumberCell } from '@/components/ui/inline-number-cell';
import {
  formatLensDisplayName,
  formatLensSpec,
} from '@/lib/lens/format';
import { ProductFilterBar } from '@/components/product/product-filter-bar';

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

function toggleInSet<T>(set: Set<T>, val: T, setter: (s: Set<T>) => void) {
  const s = new Set(set);
  if (s.has(val)) s.delete(val);
  else s.add(val);
  setter(s);
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
  const [isAdmin, setIsAdmin] = useState(false); // 현재고 수정 권한 (JINY: 권한자만)
  const [editErr, setEditErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setIsAdmin(j?.user?.role === 'admin'))
      .catch(() => {});
  }, []);

  // 인라인 편집 저장 — 성공 시 행만 로컬 갱신 (리스트 재조회 없이 즉시 반영)
  async function saveLevels(variantId: string, patch: { onHand?: number; safetyStock?: number }) {
    setEditErr(null);
    const res = await fetch('/api/warehouse/inventory', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ variantId, ...patch }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      setEditErr(j?.message ?? '저장에 실패했습니다.');
      return;
    }
    setRows((prev) =>
      prev?.map((r) =>
        r.variantId === variantId
          ? {
              ...r,
              onHand: patch.onHand ?? r.onHand,
              safetyStock: patch.safetyStock ?? r.safetyStock,
              available: (patch.onHand ?? r.onHand) - r.reserved,
            }
          : r,
      ) ?? null,
    );
  }

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

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold">재고 관리</h1>
      </header>

      {/* 검색 패널 */}
      <div className="space-y-2 rounded-2xl border border-gray-200 bg-white p-3 print:hidden">
        {/* 검색 + 브랜드/타입/주기/갯수 칩 — 공용 ProductFilterBar */}
        <ProductFilterBar
          className="space-y-2"
          facets={{ brands: allBrands, types: TYPE_OPTIONS, cycles: allCycles, packs: allPacks }}
          values={{ query: q, brands, types, cycles, packs }}
          onQuery={setQ}
          onToggleBrand={(b) => toggleInSet(brands, b, setBrands)}
          onToggleType={(t) => toggleInSet(types, t, setTypes)}
          onToggleCycle={(c) => toggleInSet(cycles, c, setCycles)}
          onTogglePack={(p) => toggleInSet(packs, p, setPacks)}
          searchPlaceholder="제품명 또는 SKU 검색"
        />
        <div className="flex flex-wrap items-center gap-2 pt-1">
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

      {editErr && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 print:hidden">{editErr}</p>
      )}

      {/* 인쇄 머리글 (인쇄물에만 표시) */}
      <div className="hidden print:block">
        <h2 className="text-lg font-bold">재고 현황</h2>
        <p className="text-xs text-gray-500">
          퍼니뷰 예약시스템 · 출력일 {new Date().toLocaleString('ko-KR')}
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">불러오는 중...</td></tr>
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
                    {/* 현재고: 권한자(admin)만 클릭 편집 — 안전재고: 모두 클릭 편집 (JINY, frame-ops 패턴) */}
                    <td className={`px-3 py-2 text-right font-semibold ${r.isLow ? 'text-red-700' : ''}`}>
                      <InlineNumberCell
                        value={r.onHand}
                        canEdit={isAdmin}
                        onSave={(n) => saveLevels(r.variantId, { onHand: n })}
                        title={isAdmin ? '클릭하여 현재고 수정 (관리자)' : '현재고 수정은 관리자만 가능합니다'}
                      />
                      <span className="ml-0.5 text-[10px] font-normal text-gray-400">팩</span>
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-gray-500">
                      <InlineNumberCell
                        value={r.safetyStock}
                        canEdit
                        onSave={(n) => saveLevels(r.variantId, { safetyStock: n })}
                        title="클릭하여 안전재고 수정"
                      />
                    </td>
                  </tr>
                );
              })}
              {!loading && rows && rows.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-10 text-center text-gray-400">조건에 맞는 재고가 없습니다</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
