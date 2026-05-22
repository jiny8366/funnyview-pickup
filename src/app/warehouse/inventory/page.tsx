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

export default function WarehouseInventoryPage() {
  return (
    <Suspense fallback={null}>
      <WarehouseInventoryInner />
    </Suspense>
  );
}

function WarehouseInventoryInner() {
  const params = useSearchParams();
  const lowOnly = params.get('low') === '1';
  const [rows, setRows] = useState<InvRow[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [delta, setDelta] = useState('');

  const load = useCallback(async () => {
    const url = '/api/warehouse/inventory' + (lowOnly ? '?low=1' : '');
    const res = await fetch(url);
    const j = await res.json();
    setRows(j.inventory ?? []);
  }, [lowOnly]);

  useEffect(() => {
    load();
  }, [load]);

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
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          재고 관리 {lowOnly && <span className="text-sm text-red-600">(저재고만)</span>}
        </h1>
      </header>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
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
              <th className="px-3 py-2 text-right">조정</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows?.map((r) => {
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
                  <td className="px-3 py-2 text-right">
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
            {rows && rows.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-10 text-center text-gray-400">데이터 없음</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
