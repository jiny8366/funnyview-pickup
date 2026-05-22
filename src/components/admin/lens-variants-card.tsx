'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatLensSpec } from '@/lib/lens/format';

interface BarcodeRow {
  id: string;
  barcode: string;
  barcodeType: string | null;
  isPrimary: boolean;
}

interface VariantRow {
  id: string;
  sku: string;
  sphere: string;
  cylinder: string | null;
  axis: number | null;
  addPower: string | null;
  udiDi: string | null;
  priceOverride: number | null;
  isActive: boolean;
  onHand: number;
  reserved: number;
  barcodes: BarcodeRow[];
}

export function LensVariantsCard({ lensId }: { lensId: string }) {
  const [variants, setVariants] = useState<VariantRow[] | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [filterCyl, setFilterCyl] = useState<string>('');
  const [filterAxis, setFilterAxis] = useState<string>('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addingBarcodeFor, setAddingBarcodeFor] = useState<string | null>(null);
  const [newBarcode, setNewBarcode] = useState('');
  const [newBarcodeType, setNewBarcodeType] = useState('EAN13');
  const [bulkPrice, setBulkPrice] = useState<string>('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/lenses/${lensId}/variants`);
    const j = await res.json();
    setVariants(
      (j.variants ?? []).map((v: VariantRow) => ({
        ...v,
        barcodes: typeof v.barcodes === 'string' ? JSON.parse(v.barcodes) : (v.barcodes ?? []),
      })),
    );
  }, [lensId]);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(v: VariantRow) {
    setBusy(true);
    setError(null);
    try {
      await fetch(`/api/admin/lenses/${lensId}/variants`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ variantId: v.id, isActive: !v.isActive }),
      });
      await load();
    } catch {
      setError('변경 실패');
    } finally {
      setBusy(false);
    }
  }

  async function addBarcode(variantId: string) {
    if (!newBarcode.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/lenses/${lensId}/variants`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ variantId, barcode: newBarcode.trim(), barcodeType: newBarcodeType }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error === 'BARCODE_EXISTS' ? '이미 등록된 바코드입니다' : j.detail ?? j.error ?? '등록 실패');
        return;
      }
      setNewBarcode('');
      setAddingBarcodeFor(null);
      await load();
    } catch {
      setError('바코드 등록 실패');
    } finally {
      setBusy(false);
    }
  }

  async function applyBulkPrice(priceOverride: number | null) {
    const ids = display.map((v) => v.id);
    if (ids.length === 0) return;
    setBulkBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/lenses/${lensId}/variants/bulk-price`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ variantIds: ids, priceOverride }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? '가격 설정 실패');
        return;
      }
      setBulkPrice('');
      await load();
    } catch {
      setError('가격 설정 실패');
    } finally {
      setBulkBusy(false);
    }
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const isToric = useMemo(
    () => variants?.some((v) => v.cylinder !== null) ?? false,
    [variants],
  );

  const uniqueCyls = useMemo(
    () =>
      [...new Set(variants?.filter((v) => v.cylinder !== null).map((v) => v.cylinder as string) ?? [])]
        .sort((a, b) => Number(a) - Number(b)),
    [variants],
  );

  const uniqueAxes = useMemo(
    () =>
      [...new Set(variants?.filter((v) => v.axis !== null).map((v) => String(v.axis)) ?? [])]
        .sort((a, b) => Number(a) - Number(b)),
    [variants],
  );

  const display = useMemo(() => {
    if (!variants) return [];
    let list = showInactive ? variants : variants.filter((v) => v.isActive);
    if (filterCyl !== '') list = list.filter((v) => v.cylinder === filterCyl);
    if (filterAxis !== '') list = list.filter((v) => String(v.axis) === filterAxis);
    return list;
  }, [variants, showInactive, filterCyl, filterAxis]);

  if (!variants) {
    return (
      <Card>
        <CardBody><p className="text-sm text-gray-400">도수 목록 불러오는 중...</p></CardBody>
      </Card>
    );
  }

  const activeCount = variants.filter((v) => v.isActive).length;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>도수별 SKU</CardTitle>
          <CardDescription>
            전체 {variants.length}개 도수 · 활성 {activeCount}개
            {display.length !== variants.length && (
              <span className="ml-1 text-brand-600">· 필터 {display.length}개 표시</span>
            )}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isToric && uniqueCyls.length > 0 && (
            <select
              value={filterCyl}
              onChange={(e) => { setFilterCyl(e.target.value); setFilterAxis(''); }}
              className="h-8 rounded-lg border border-gray-200 px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-100"
            >
              <option value="">CYL 전체</option>
              {uniqueCyls.map((c) => (
                <option key={c} value={c}>
                  CYL {Number(c) >= 0 ? '+' : ''}{Number(c).toFixed(2)}
                </option>
              ))}
            </select>
          )}
          {isToric && uniqueAxes.length > 0 && (
            <select
              value={filterAxis}
              onChange={(e) => setFilterAxis(e.target.value)}
              className="h-8 rounded-lg border border-gray-200 px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-100"
            >
              <option value="">AXIS 전체</option>
              {uniqueAxes.map((a) => (
                <option key={a} value={a}>
                  AXIS {a}°
                </option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="h-4 w-4"
            />
            비활성 포함
          </label>
        </div>
      </CardHeader>

      {/* 가격 일괄 설정 */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-2.5">
        <span className="shrink-0 text-xs font-medium text-gray-600">
          표시된 {display.length}개 도수 가격:
        </span>
        <input
          type="number"
          min={0}
          value={bulkPrice}
          onChange={(e) => setBulkPrice(e.target.value)}
          placeholder="₩ 입력"
          className="h-8 w-32 rounded-lg border border-gray-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
        <Button
          size="sm"
          disabled={bulkBusy || bulkPrice === ''}
          onClick={() => {
            const n = Number(bulkPrice);
            if (!Number.isNaN(n) && n >= 0) applyBulkPrice(n);
          }}
        >
          적용
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={bulkBusy}
          onClick={() => applyBulkPrice(null)}
        >
          초기화
        </Button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>

      <CardBody className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">도수</th>
                <th className="px-3 py-2 text-left font-mono">SKU</th>
                <th className="px-3 py-2 text-right">재고 (팩)</th>
                <th className="px-3 py-2 text-right">예약</th>
                <th className="px-3 py-2 text-right">가격 오버라이드</th>
                <th className="px-3 py-2 text-center">활성</th>
                <th className="px-3 py-2 text-center">바코드</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {display.map((v) => {
                const isOpen = expanded.has(v.id);
                return [
                  <tr key={v.id} className={!v.isActive ? 'opacity-50 bg-gray-50' : ''}>
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {formatLensSpec(v) || '기본'}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">{v.sku}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{v.onHand}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{v.reserved}</td>
                    <td className="px-3 py-2 text-right text-gray-700">
                      {v.priceOverride != null ? `₩${v.priceOverride.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        disabled={busy}
                        onClick={() => toggleActive(v)}
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          v.isActive
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {v.isActive ? '활성' : '비활성'}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => toggleExpand(v.id)}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        {v.barcodes.length}개 {isOpen ? '▲' : '▼'}
                      </button>
                    </td>
                  </tr>,
                  isOpen && (
                    <tr key={`${v.id}-detail`} className="bg-blue-50/40">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="space-y-2">
                          {v.udiDi && (
                            <p className="text-xs text-gray-500">
                              UDI-DI: <span className="font-mono">{v.udiDi}</span>
                            </p>
                          )}
                          {v.barcodes.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {v.barcodes.map((b) => (
                                <span
                                  key={b.id}
                                  className={`rounded-md px-2 py-1 font-mono text-xs ${
                                    b.isPrimary
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-gray-100 text-gray-700'
                                  }`}
                                >
                                  {b.barcode}
                                  {b.barcodeType && <span className="ml-1 opacity-60">({b.barcodeType})</span>}
                                  {b.isPrimary && <span className="ml-1 text-blue-600">★</span>}
                                </span>
                              ))}
                            </div>
                          )}

                          {addingBarcodeFor === v.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={newBarcode}
                                onChange={(e) => setNewBarcode(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addBarcode(v.id)}
                                placeholder="바코드 번호"
                                className="h-8 w-40 rounded border border-gray-300 px-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                                autoFocus
                              />
                              <select
                                value={newBarcodeType}
                                onChange={(e) => setNewBarcodeType(e.target.value)}
                                className="h-8 rounded border border-gray-300 px-1 text-xs focus:outline-none"
                              >
                                <option value="EAN13">EAN-13</option>
                                <option value="CODE128">CODE-128</option>
                                <option value="manufacturer">제조사</option>
                              </select>
                              <Button size="sm" disabled={busy} onClick={() => addBarcode(v.id)}>
                                추가
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => { setAddingBarcodeFor(null); setNewBarcode(''); }}
                              >
                                취소
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => { setAddingBarcodeFor(v.id); setNewBarcode(''); }}
                            >
                              + 바코드 추가
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ),
                ];
              })}
              {display.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                    {showInactive ? '등록된 도수가 없습니다' : '활성 도수가 없습니다 (비활성 포함 체크 후 확인)'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}
