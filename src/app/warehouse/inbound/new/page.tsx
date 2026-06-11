'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { IconSearch } from '@/components/ui/icons';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Supplier {
  id: string;
  name: string;
}

interface ScanLine {
  variantId: string;
  lensId: string;
  displayName: string;
  sku: string;
  currentStock: number;
  quantity: number;
  unitCost: number; // 부가세 포함 KRW
}

interface LookupResponse {
  parsed: { di: string | null; format: string };
  match: {
    variant: { id: string; sku: string };
    lens: { id: string };
    displayName: string;
    inventory: { quantityOnHand: number } | null;
    lastUnitCost: number;
  } | null;
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
  const scanRef = useRef<HTMLInputElement | null>(null);

  // 전표 헤더
  const [inboundDate, setInboundDate] = useState(todayISO());
  const [invoiceRef, setInvoiceRef] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // 스캔 라인
  const [lines, setLines] = useState<ScanLine[]>([]);
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // 제출
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // 매입처 로드 (활성만)
  useEffect(() => {
    fetch('/api/warehouse/suppliers')
      .then((r) => (r.ok ? r.json() : { suppliers: [] }))
      .then((d) => setSuppliers(d.suppliers ?? []))
      .catch(() => setSuppliers([]));
  }, []);

  useEffect(() => {
    scanRef.current?.focus();
  }, []);

  const handleScan = useCallback(
    async (text: string) => {
      const value = text.trim();
      if (!value) return;
      setBusy(true);
      setScanError(null);
      try {
        const res = await fetch('/api/warehouse/inbound/lookup', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ raw: value }),
        });
        const j: LookupResponse = await res.json();
        if (!res.ok || !j.match) {
          setScanError('매칭되는 SKU 가 없습니다. 바코드를 확인하세요.');
          return;
        }
        const m = j.match;
        setLines((prev) => {
          const idx = prev.findIndex((l) => l.variantId === m.variant.id);
          if (idx >= 0) {
            // 중복 스캔 → 수량 +1
            const next = [...prev];
            next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
            return next;
          }
          return [
            {
              variantId: m.variant.id,
              lensId: m.lens.id,
              displayName: m.displayName,
              sku: m.variant.sku,
              currentStock: m.inventory?.quantityOnHand ?? 0,
              quantity: 1,
              unitCost: m.lastUnitCost ?? 0,
            },
            ...prev,
          ];
        });
        setRaw('');
      } finally {
        setBusy(false);
        scanRef.current?.focus();
      }
    },
    [],
  );

  function onSubmitScan(e: React.FormEvent) {
    e.preventDefault();
    handleScan(raw);
  }

  function updateLine(variantId: string, field: 'quantity' | 'unitCost', value: number) {
    setLines((prev) =>
      prev.map((l) => (l.variantId === variantId ? { ...l, [field]: value } : l)),
    );
  }

  function removeLine(variantId: string) {
    setLines((prev) => prev.filter((l) => l.variantId !== variantId));
  }

  const totalQty = lines.reduce((s, l) => s + l.quantity, 0);
  const totalCost = lines.reduce((s, l) => s + l.quantity * l.unitCost, 0);
  const hasZeroCost = lines.some((l) => l.unitCost <= 0);

  async function submit() {
    if (lines.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/warehouse/inbound', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          inboundDate,
          invoiceRef: invoiceRef || null,
          supplierId: supplierId || null,
          lines: lines.map((l) => ({
            variantId: l.variantId,
            lensId: l.lensId,
            quantity: l.quantity,
            unitCostIncVat: l.unitCost,
          })),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail ?? j.error ?? '입고 실패');
      }
      router.push('/warehouse/inbound/history');
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : '입고 실패');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">입고 등록 (바코드 스캔)</h1>
          <p className="mt-1 text-sm text-gray-500">
            바코드를 스캔하면 자동으로 목록에 추가됩니다. 동일 제품은 수량이 합산됩니다.
          </p>
        </div>
        <div className="flex gap-2">
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
              <label className="mb-1 block text-xs font-medium text-gray-700">매입처</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="input"
              >
                <option value="">선택 안 함</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
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
          </div>
        </CardBody>
      </Card>

      {/* 스캔 입력 */}
      <Card>
        <CardBody>
          <form onSubmit={onSubmitScan} className="flex gap-2">
            <div className="relative flex-1">
              <IconSearch
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                ref={scanRef}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder="바코드 스캔 또는 입력 후 Enter"
                className="h-12 w-full rounded-lg border-2 border-brand-200 bg-white pl-10 pr-3 text-base font-mono text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <Button type="submit" size="lg" disabled={!raw || busy}>
              {busy ? '조회 중...' : '추가'}
            </Button>
          </form>
          {scanError && <p className="mt-3 text-sm text-red-600">⚠️ {scanError}</p>}
        </CardBody>
      </Card>

      {/* 스캔 목록 */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>입고 목록 ({lines.length})</CardTitle>
            <CardDescription>
              단가는 최근 매입 로트에서 자동 입력됩니다. 단가 변동 시 직접 수정하세요.
            </CardDescription>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {lines.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-500">
              아직 스캔된 항목이 없습니다. 위 입력창에 바코드를 스캔하세요.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">제품</th>
                    <th className="px-3 py-2 text-left font-mono text-gray-400">SKU</th>
                    <th className="px-3 py-2 text-right">현재고</th>
                    <th className="px-3 py-2 text-right">수량 (팩)</th>
                    <th className="px-3 py-2 text-right">단가 (₩, VAT포함)</th>
                    <th className="px-3 py-2 text-right">소계</th>
                    <th className="px-3 py-2 text-center">삭제</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lines.map((l) => (
                    <tr key={l.variantId}>
                      <td className="px-3 py-2 font-medium text-gray-900">{l.displayName}</td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-400">{l.sku}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{l.currentStock}</td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={l.quantity || ''}
                          onChange={(e) =>
                            updateLine(
                              l.variantId,
                              'quantity',
                              Math.max(1, Math.floor(Number(e.target.value) || 1)),
                            )
                          }
                          className="h-8 w-20 rounded border border-gray-300 bg-white px-2 text-right font-mono text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          value={l.unitCost || ''}
                          onChange={(e) =>
                            updateLine(
                              l.variantId,
                              'unitCost',
                              Math.max(0, Number(e.target.value) || 0),
                            )
                          }
                          placeholder="단가"
                          className={`h-8 w-24 rounded border bg-white px-2 text-right font-mono text-sm focus:outline-none focus:ring-1 ${
                            l.unitCost <= 0
                              ? 'border-amber-400 focus:ring-amber-100'
                              : 'border-gray-300 focus:border-blue-400 focus:ring-blue-100'
                          }`}
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700">
                        {l.quantity * l.unitCost > 0
                          ? (l.quantity * l.unitCost).toLocaleString() + '원'
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(l.variantId)}
                          className="text-xs text-gray-400 hover:text-red-600"
                          aria-label="라인 삭제"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-gray-700">합계</td>
                    <td className="px-3 py-2 text-right">{totalQty.toLocaleString()}팩</td>
                    <td />
                    <td className="px-3 py-2 text-right">{totalCost.toLocaleString()}원</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* 제출 영역 */}
      {lines.length > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-blue-900">
              <strong>{lines.length}개 품목</strong> · 총{' '}
              <strong>{totalQty.toLocaleString()}팩</strong> ·{' '}
              <strong>₩{totalCost.toLocaleString()}</strong> 입고 예정
            </div>
            <div className="flex items-center gap-3">
              {submitError && <span className="text-sm text-red-600">⚠️ {submitError}</span>}
              <Button onClick={submit} disabled={submitting}>
                {submitting ? '등록 중...' : '입고 등록'}
              </Button>
            </div>
          </div>
          {hasZeroCost && (
            <p className="mt-2 text-xs text-amber-700">
              ⚠️ 단가가 0원인 품목이 있습니다. 등록 전 단가를 확인하세요.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
