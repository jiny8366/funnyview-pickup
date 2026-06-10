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
  { value: '', label: '전체 유형' },
  { value: 'spherical', label: '구면(투명)' },
  { value: 'toric', label: '난시(토릭)' },
  { value: 'multifocal', label: '다초점' },
  { value: 'color', label: '컬러' },
];

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
  const [brand, setBrand] = useState('');
  const [type, setType] = useState('');
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
        if (brand.trim()) sp.set('brand', brand.trim());
        if (type) sp.set('type', type);
        if (lowOnly) sp.set('low', '1');
      }
      return sp;
    },
    [q, brand, type, lowOnly],
  );

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
            placeholder="제품명 또는 SKU"
            className="h-9 w-56 rounded-lg border border-gray-200 px-3 text-sm"
          />
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="브랜드 (예: 아큐브)"
            className="h-9 w-36 rounded-lg border border-gray-200 px-3 text-sm"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-9 rounded-lg border border-gray-200 px-2 text-sm"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
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

      {/* 인쇄 머리글 (인쇄물에만 표시) */}
      <div className="hidden print:block">
        <h2 className="text-lg font-bold">재고 현황</h2>
        <p className="text-xs text-gray-500">
          Funnyview Pickup · 출력일 {new Date().toLocaleString('ko-KR')}
          {q && ` · 검색어 "${q}"`}{brand && ` · 브랜드 ${brand}`}{lowOnly && ' · 저재고만'}
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
                <th className="px-3 py-2 text-right">예약</th>
                <th className="px-3 py-2 text-right">가용</th>
                <th className="px-3 py-2 text-right">안전</th>
                <th className="px-3 py-2 text-right">로트</th>
                <th className="px-3 py-2 text-right">평균단가</th>
                <th className="px-3 py-2 text-right">최초입고일</th>
                <th className="px-3 py-2 text-right print:hidden">조정</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr><td colSpan={10} className="px-3 py-6 text-center text-gray-400">불러오는 중...</td></tr>
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
                    <td className="px-3 py-2 text-right">
                      <div className="font-semibold">{r.onHand}</div>
                      <div className="text-[10px] text-gray-400">
                        ({(r.onHand * r.piecesPerBox).toLocaleString()}매)
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500">{r.reserved}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${r.isLow ? 'text-red-700' : ''}`}>
                      {r.available}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-gray-500">{r.safetyStock}</td>
                    <td className="px-3 py-2 text-right text-xs">
                      {r.lotCount > 0 ? (
                        <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-blue-700">{r.lotCount}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-gray-700">
                      {r.weightedAvgCost > 0 ? r.weightedAvgCost.toLocaleString() + '원' : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-gray-500">
                      {r.oldestInboundDate ?? <span className="text-gray-300">—</span>}
                    </td>
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
                <tr><td colSpan={10} className="px-3 py-10 text-center text-gray-400">조건에 맞는 재고가 없습니다</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
