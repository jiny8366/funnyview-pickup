'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatLensSpec } from '@/lib/lens/format';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

interface LensRow {
  id: string;
  brand: string;
  name: string;
  productCode: string;
  lensType: string;
  replacementCycle: string;
  piecesPerBox: number;
}

interface VariantRow {
  id: string;
  sku: string;
  sphere: string;
  cylinder: string | null;
  axis: number | null;
  addPower: string | null;
  isActive: boolean;
  onHand: number;
}

interface LineItem {
  variantId: string;
  quantity: number;
  unitCost: number;
}

export default function InboundNewPage() {
  return (
    <Suspense fallback={null}>
      <InboundNewInner />
    </Suspense>
  );
}

function InboundNewInner() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement | null>(null);

  // 전표 헤더
  const [inboundDate, setInboundDate] = useState(todayISO());
  const [invoiceRef, setInvoiceRef] = useState('');
  const [note, setNote] = useState('');
  const [commonCost, setCommonCost] = useState<number>(0);

  // 제품 선택
  const [lensQ, setLensQ] = useState('');
  const [lensResults, setLensResults] = useState<LensRow[]>([]);
  const [selectedLens, setSelectedLens] = useState<LensRow | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // 도수 목록 + 라인 아이템
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [lines, setLines] = useState<Record<string, LineItem>>({}); // variantId → line
  const [showInactive, setShowInactive] = useState(false);

  // 제출
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // 제품 검색
  const searchLenses = useCallback(async (q: string) => {
    if (!q.trim()) { setLensResults([]); return; }
    const res = await fetch(`/api/warehouse/lenses?q=${encodeURIComponent(q)}`);
    const j = await res.json();
    setLensResults(j.lenses ?? []);
    setShowDropdown(true);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchLenses(lensQ), 250);
    return () => clearTimeout(t);
  }, [lensQ, searchLenses]);

  // 제품 선택 시 도수 목록 로드
  async function selectLens(lens: LensRow) {
    setSelectedLens(lens);
    setLensQ(`${lens.brand} — ${lens.name}`);
    setShowDropdown(false);
    setLines({});

    const res = await fetch('/api/warehouse/lenses', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lensId: lens.id }),
    });
    const j = await res.json();
    setVariants(j.variants ?? []);
  }

  function setLine(variantId: string, field: 'quantity' | 'unitCost', value: number) {
    setLines((prev) => ({
      ...prev,
      [variantId]: {
        variantId,
        quantity: field === 'quantity' ? value : (prev[variantId]?.quantity ?? 0),
        unitCost: field === 'unitCost' ? value : (prev[variantId]?.unitCost ?? commonCost),
      },
    }));
  }

  function applyCommonCost() {
    setLines((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (next[id].quantity > 0) {
          next[id] = { ...next[id], unitCost: commonCost };
        }
      }
      return next;
    });
  }

  const activeItems = Object.values(lines).filter((l) => l.quantity > 0 && l.unitCost > 0);
  const totalQty = activeItems.reduce((s, l) => s + l.quantity, 0);
  const totalCost = activeItems.reduce((s, l) => s + l.quantity * l.unitCost, 0);

  async function submit() {
    if (!selectedLens || activeItems.length === 0) return;
    setBusy(true);
    setSubmitError(null);
    try {
      for (const item of activeItems) {
        const res = await fetch('/api/warehouse/inbound', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            variantId: item.variantId,
            quantity: item.quantity,
            unitCostIncVat: item.unitCost,
            inboundDate,
            invoiceRef: invoiceRef || null,
            note: note || null,
          }),
        });
        if (!res.ok) {
          const j = await res.json();
          throw new Error(j.detail ?? j.error ?? '입고 실패');
        }
      }
      router.push('/warehouse/inbound/history');
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : '입고 실패');
    } finally {
      setBusy(false);
    }
  }

  const displayVariants = showInactive ? variants : variants.filter((v) => v.isActive);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">전표 입고 등록</h1>
          <p className="mt-1 text-sm text-gray-500">
            제품을 선택하면 활성 도수 목록이 표시됩니다. 수량과 단가를 입력하고 일괄 등록하세요.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => router.push('/warehouse/inbound')}>
            바코드 스캔
          </Button>
          <Button variant="secondary" size="sm" onClick={() => router.push('/warehouse/inbound/history')}>
            이력 조회
          </Button>
        </div>
      </div>

      {/* 전표 헤더 */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>전표 정보</CardTitle>
            <CardDescription>입고일, 전표번호, 메모를 입력하세요</CardDescription>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">입고일</label>
              <input
                type="date"
                value={inboundDate}
                onChange={(e) => setInboundDate(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">전표번호 (선택)</label>
              <input
                type="text"
                value={invoiceRef}
                onChange={(e) => setInvoiceRef(e.target.value)}
                placeholder="세금계산서 / 거래명세서 번호"
                className="input"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">메모 (선택)</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="비고"
                className="input"
              />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* 제품 선택 */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>제품 선택</CardTitle>
            <CardDescription>브랜드, 제품명, 제품코드로 검색하세요</CardDescription>
          </div>
        </CardHeader>
        <CardBody>
          <div className="relative">
            <Input
              ref={searchRef}
              value={lensQ}
              onChange={(e) => {
                setLensQ(e.target.value);
                setSelectedLens(null);
                setVariants([]);
              }}
              onFocus={() => lensQ && setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
              placeholder="예: 아큐브 모이스트, ACU-AND1M-30P"
              className="w-full"
            />
            {showDropdown && lensResults.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                {lensResults.map((l) => (
                  <li key={l.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50"
                      onMouseDown={() => selectLens(l)}
                    >
                      <span className="font-medium text-gray-900">{l.brand} — {l.name}</span>
                      <span className="text-xs text-gray-400">{l.productCode}</span>
                      <span className="ml-auto text-xs text-gray-400">{l.replacementCycle} / {l.piecesPerBox}매</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardBody>
      </Card>

      {/* 도수 목록 + 수량 입력 */}
      {selectedLens && variants.length > 0 && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{selectedLens.brand} — {selectedLens.name}</CardTitle>
              <CardDescription>
                {displayVariants.length}개 도수 표시 중 ({variants.filter((v) => v.isActive).length}개 활성)
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="h-3.5 w-3.5"
                />
                비활성 포함
              </label>
            </div>
          </CardHeader>

          {/* 공통 단가 적용 */}
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-2.5">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  공통 단가 (부가세 포함 KRW)
                </label>
                <input
                  type="number"
                  min={0}
                  value={commonCost || ''}
                  onChange={(e) => setCommonCost(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="예: 8500"
                  className="h-9 w-36 rounded-md border border-gray-300 bg-white px-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={commonCost <= 0}
                onClick={applyCommonCost}
              >
                수량 입력된 행에 적용
              </Button>
              <p className="text-xs text-gray-500">
                ⓘ 도수마다 단가가 다르면 아래 표에서 개별 수정하세요.
              </p>
            </div>
          </div>

          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">도수</th>
                    <th className="px-3 py-2 text-left font-mono text-gray-400">SKU</th>
                    <th className="px-3 py-2 text-right">현재고</th>
                    <th className="px-3 py-2 text-right">입고 수량 (팩)</th>
                    <th className="px-3 py-2 text-right">단가 (₩, VAT포함)</th>
                    <th className="px-3 py-2 text-right">소계</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayVariants.map((v) => {
                    const line = lines[v.id];
                    const qty = line?.quantity ?? 0;
                    const cost = line?.unitCost ?? commonCost;
                    const subtotal = qty * cost;

                    return (
                      <tr
                        key={v.id}
                        className={`${!v.isActive ? 'opacity-50' : ''} ${qty > 0 ? 'bg-blue-50/50' : ''}`}
                      >
                        <td className="px-3 py-2 font-medium text-gray-900">
                          {formatLensSpec(v) || '기본'}
                          {!v.isActive && (
                            <span className="ml-1.5 rounded bg-gray-200 px-1 py-0.5 text-[10px] text-gray-500">
                              비활성
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-400">{v.sku}</td>
                        <td className="px-3 py-2 text-right text-sm text-gray-600">{v.onHand}</td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={qty || ''}
                            onChange={(e) =>
                              setLine(v.id, 'quantity', Math.max(0, Math.floor(Number(e.target.value) || 0)))
                            }
                            placeholder="0"
                            className="h-8 w-20 rounded border border-gray-300 bg-white px-2 text-right font-mono text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={cost || ''}
                            onChange={(e) =>
                              setLine(v.id, 'unitCost', Math.max(0, Number(e.target.value) || 0))
                            }
                            placeholder={commonCost ? String(commonCost) : '단가'}
                            className={`h-8 w-24 rounded border bg-white px-2 text-right font-mono text-sm focus:outline-none focus:ring-1 ${
                              qty > 0 && cost <= 0
                                ? 'border-amber-400 focus:ring-amber-100'
                                : 'border-gray-300 focus:border-blue-400 focus:ring-blue-100'
                            }`}
                          />
                        </td>
                        <td className="px-3 py-2 text-right text-sm text-gray-700">
                          {subtotal > 0 ? subtotal.toLocaleString() + '원' : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {totalQty > 0 && (
                  <tfoot className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-gray-700">합계</td>
                      <td className="px-3 py-2 text-right">{totalQty.toLocaleString()}팩</td>
                      <td />
                      <td className="px-3 py-2 text-right">{totalCost.toLocaleString()}원</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* 제출 영역 */}
      {selectedLens && activeItems.length > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-blue-900">
              <strong>{activeItems.length}개 도수</strong> · 총{' '}
              <strong>{totalQty.toLocaleString()}팩</strong> ·{' '}
              <strong>₩{totalCost.toLocaleString()}</strong> 입고 예정
            </div>
            <div className="flex items-center gap-3">
              {submitError && (
                <span className="text-sm text-red-600">⚠️ {submitError}</span>
              )}
              <Button onClick={submit} disabled={busy}>
                {busy ? '등록 중...' : '전표 입고 등록'}
              </Button>
            </div>
          </div>
          {activeItems.some((l) => l.unitCost <= 0) && (
            <p className="mt-2 text-xs text-amber-700">
              ⚠️ 단가가 0원인 도수가 있습니다. 등록 전 단가를 확인하세요.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
