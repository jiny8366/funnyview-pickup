'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatLensSpec } from '@/lib/lens/format';

interface LotLine {
  lotId: string;
  variantId: string;
  sku: string;
  sphere: string;
  cylinder: string | null;
  axis: number | null;
  addPower: string | null;
  quantityReceived: number;
  quantityRemaining: number;
  unitCostIncVat: number;
}

interface Shipment {
  id: string;
  inboundDate: string;
  status: string;
  confirmedAt: string | null;
  invoiceRef: string | null;
  note: string | null;
  lensId: string;
  lensName: string;
  brand: string;
  createdAt: string;
  createdByName: string | null;
  lots: LotLine[];
  totalQty: number;
  totalCost: number;
}

interface ApiResponse {
  shipments: Shipment[];
  total: number;
  page: number;
  limit: number;
}

export default function InboundHistoryPage() {
  return (
    <Suspense fallback={null}>
      <InboundHistoryInner />
    </Suspense>
  );
}

function InboundHistoryInner() {
  const router = useRouter();
  const params = useSearchParams();

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const page = Number(params.get('page') ?? 1);
  const q = params.get('q') ?? '';
  const status = params.get('status') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';

  const [localQ, setLocalQ] = useState(q);

  const load = useCallback(async () => {
    setLoading(true);
    const sp = new URLSearchParams();
    if (page > 1) sp.set('page', String(page));
    if (q) sp.set('q', q);
    if (status) sp.set('status', status);
    if (from) sp.set('from', from);
    if (to) sp.set('to', to);
    const res = await fetch(`/api/warehouse/inbound/history?${sp}`);
    const j: ApiResponse = await res.json();
    setData(j);
    setLoading(false);
  }, [page, q, status, from, to]);

  useEffect(() => { load(); }, [load]);

  function navigate(updates: Record<string, string>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) sp.set(k, v); else sp.delete(k);
    }
    sp.delete('page');
    router.push(`/warehouse/inbound/history?${sp}`);
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">입고 이력</h1>
        <Button variant="secondary" size="sm" onClick={() => router.push('/warehouse/inbound')}>
          입고 등록
        </Button>
      </div>

      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3">
        <Input
          className="w-48"
          placeholder="브랜드/제품명/전표번호"
          value={localQ}
          onChange={(e) => setLocalQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && navigate({ q: localQ })}
        />
        <Button size="sm" variant="secondary" onClick={() => navigate({ q: localQ })}>
          검색
        </Button>
        <div className="h-5 w-px bg-gray-200" />
        {(['', 'confirmed', 'draft'] as const).map((s) => (
          <button
            key={s || 'all'}
            onClick={() => navigate({ status: s })}
            className={`rounded-full px-3 py-1 text-sm ${
              status === s
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s === '' ? '전체' : s === 'confirmed' ? '확정' : '임시저장'}
          </button>
        ))}
        <div className="h-5 w-px bg-gray-200" />
        <input
          type="date"
          value={from}
          onChange={(e) => navigate({ from: e.target.value })}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
          placeholder="시작일"
        />
        <span className="text-gray-400 text-sm">~</span>
        <input
          type="date"
          value={to}
          onChange={(e) => navigate({ to: e.target.value })}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
          placeholder="종료일"
        />
        {(q || status || from || to) && (
          <Button size="sm" variant="ghost" onClick={() => router.push('/warehouse/inbound/history')}>
            초기화
          </Button>
        )}
      </div>

      {/* 결과 수 */}
      {data && (
        <p className="text-sm text-gray-500">
          총 <strong>{data.total.toLocaleString()}</strong>건
        </p>
      )}

      {/* 전표 목록 */}
      <div className="space-y-2">
        {loading && (
          <div className="py-12 text-center text-gray-400">불러오는 중...</div>
        )}
        {!loading && data?.shipments.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white py-12 text-center text-gray-400">
            조건에 맞는 입고 전표가 없습니다.
          </div>
        )}
        {data?.shipments.map((s) => {
          const isOpen = expanded.has(s.id);
          return (
            <div key={s.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              {/* 전표 헤더 */}
              <button
                className="flex w-full items-start justify-between px-4 py-3 text-left hover:bg-gray-50"
                onClick={() => toggleExpand(s.id)}
              >
                <div className="flex items-start gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{s.brand} — {s.lensName}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          s.status === 'confirmed'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {s.status === 'confirmed' ? '확정' : '임시저장'}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
                      <span>입고일 {s.inboundDate}</span>
                      {s.invoiceRef && <span>전표# {s.invoiceRef}</span>}
                      <span>도수 {s.lots.length}종 · 총 {s.totalQty.toLocaleString()}팩</span>
                      <span>합계 {s.totalCost.toLocaleString()}원</span>
                      {s.createdByName && <span>등록 {s.createdByName}</span>}
                    </div>
                  </div>
                </div>
                <span className="text-gray-400 text-xs mt-1">{isOpen ? '▲' : '▼'}</span>
              </button>

              {/* 도수별 로트 라인 */}
              {isOpen && (
                <div className="border-t border-gray-100">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="px-4 py-1.5 text-left">SKU</th>
                        <th className="px-4 py-1.5 text-left">도수</th>
                        <th className="px-4 py-1.5 text-right">입고수량</th>
                        <th className="px-4 py-1.5 text-right">잔여</th>
                        <th className="px-4 py-1.5 text-right">단가(부가세포함)</th>
                        <th className="px-4 py-1.5 text-right">소계</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {s.lots.map((l) => (
                        <tr key={l.lotId} className={l.quantityRemaining === 0 ? 'opacity-40' : ''}>
                          <td className="px-4 py-1.5 font-mono text-gray-500">{l.sku}</td>
                          <td className="px-4 py-1.5 text-gray-700">{formatLensSpec(l) || '—'}</td>
                          <td className="px-4 py-1.5 text-right">{l.quantityReceived.toLocaleString()}</td>
                          <td className={`px-4 py-1.5 text-right font-semibold ${l.quantityRemaining < l.quantityReceived ? 'text-orange-600' : ''}`}>
                            {l.quantityRemaining.toLocaleString()}
                          </td>
                          <td className="px-4 py-1.5 text-right">{l.unitCostIncVat.toLocaleString()}원</td>
                          <td className="px-4 py-1.5 text-right text-gray-700">
                            {(l.quantityReceived * l.unitCostIncVat).toLocaleString()}원
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-gray-200 bg-gray-50 font-semibold">
                      <tr>
                        <td colSpan={2} className="px-4 py-2 text-gray-700">합계</td>
                        <td className="px-4 py-2 text-right">{s.totalQty.toLocaleString()}</td>
                        <td />
                        <td />
                        <td className="px-4 py-2 text-right">{s.totalCost.toLocaleString()}원</td>
                      </tr>
                    </tfoot>
                  </table>
                  {s.note && (
                    <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100">
                      메모: {s.note}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => navigate({ page: String(page - 1) })}
          >
            이전
          </Button>
          <span className="text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => navigate({ page: String(page + 1) })}
          >
            다음
          </Button>
        </div>
      )}
    </div>
  );
}
