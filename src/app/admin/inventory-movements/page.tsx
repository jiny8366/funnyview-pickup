'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { PageHeader, PageWrap } from '@/components/admin/page-header';
import { formatDateTime } from '@/lib/utils/format';

interface MovementRow {
  id: string;
  movementType: string;
  quantity: number;
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  performedAt: string;
  sku: string;
  brand: string;
  lensName: string;
  sphere: string;
  cylinder: string | null;
  axis: number | null;
}

const TYPE_META: Record<string, { label: string; cls: string }> = {
  inbound: { label: '입고', cls: 'bg-emerald-50 text-emerald-700' },
  outbound: { label: '출고', cls: 'bg-blue-50 text-blue-700' },
  reserve: { label: '예약(주문)', cls: 'bg-amber-50 text-amber-700' },
  release: { label: '예약해제', cls: 'bg-gray-100 text-gray-600' },
  adjust: { label: '조정', cls: 'bg-purple-50 text-purple-700' },
  return: { label: '반품입고', cls: 'bg-rose-50 text-rose-700' },
};
const REF_LABEL: Record<string, string> = {
  order: '고객주문', inbound: '입고전표', adjustment: '재고조정', return: '반품', store_order: '가맹점발주',
};
const TYPES = Object.keys(TYPE_META);

function powerOf(r: MovementRow): string {
  const p = [`SPH ${r.sphere}`];
  if (r.cylinder) p.push(`CYL ${r.cylinder}`);
  if (r.axis != null) p.push(`AX ${r.axis}`);
  return p.join(' / ');
}

function MovementsInner() {
  const [rows, setRows] = useState<MovementRow[] | null>(null);
  const [types, setTypes] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (types.size > 0) sp.set('type', [...types].join(','));
      if (q.trim()) sp.set('q', q.trim());
      const res = await fetch('/api/admin/inventory-movements' + (sp.size ? '?' + sp.toString() : ''), { cache: 'no-store' });
      const j = await res.json();
      setRows(j.movements ?? []);
    } finally {
      setLoading(false);
    }
  }, [types, q]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [types]);

  // 구분 필터는 단일선택(중복선택 방지) — 누른 항목만 활성, 같은 항목 다시 누르면 전체(해제).
  const toggleType = (t: string) =>
    setTypes((s) => (s.has(t) && s.size === 1 ? new Set() : new Set([t])));

  return (
    <PageWrap>
      <PageHeader
        title="재고 입출고 내역"
        description="고객주문(예약·출고) · 가맹점발주 · 입고 · 조정이 재고에 반영된 기록입니다 (최근 200건)."
      />

      {/* 필터 */}
      <div className="mb-3 space-y-2 rounded-xl border border-gray-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => toggleType(t)}
              className={`press rounded-full border px-3 py-1 text-xs font-medium ${
                types.has(t) ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-500 hover:border-gray-400'
              }`}
            >
              {TYPE_META[t].label}
            </button>
          ))}
          <input
            className="input ml-auto w-56 placeholder:text-gray-300"
            placeholder="제품명 또는 SKU 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">일시</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">구분</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">제품 / 도수</th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">수량</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">참조</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">불러오는 중…</td></tr>
            )}
            {!loading && rows && rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">내역이 없습니다</td></tr>
            )}
            {!loading && rows?.map((r) => {
              const meta = TYPE_META[r.movementType] ?? { label: r.movementType, cls: 'bg-gray-100 text-gray-600' };
              return (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-xs text-gray-500">{formatDateTime(r.performedAt)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${meta.cls}`}>{meta.label}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-gray-900">{r.brand} {r.lensName}</div>
                    <div className="text-[11px] text-gray-500">{r.sku} · {powerOf(r)}</div>
                  </td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${r.quantity > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {r.quantity > 0 ? `+${r.quantity}` : r.quantity}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">
                    {r.referenceType ? (REF_LABEL[r.referenceType] ?? r.referenceType) : '—'}
                    {r.note && <div className="text-[11px] text-gray-400">{r.note}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </PageWrap>
  );
}

export default function AdminInventoryMovementsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-400">불러오는 중…</div>}>
      <MovementsInner />
    </Suspense>
  );
}
