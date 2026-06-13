'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { StatusBadge } from '@/components/ui/badge';
import { formatKRW, formatDateTime } from '@/lib/utils/format';
import { ORDER_STATUS_LABEL, type OrderStatus } from '@/types/order';

const ALL_STATUSES: OrderStatus[] = [
  'pending', 'paid', 'accepted', 'picking', 'shipped', 'arrived', 'ready', 'completed', 'cancelled', 'no_show', 'returned',
];

interface OrderRow {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  total: number;
  isPaid: number;
  createdAt: string;
  customerName: string | null;
  orderedByStoreId: string | null;
  storeName: string | null;
  itemCount: number;
}

/**
 * 어드민 주문 통합 모니터링 — 전체 주문을 상태별로 조회.
 * 데이터는 /api/warehouse/orders (admin 허용, status 콤마 복수). 처리는 각 단계 화면에서.
 */
export function AdminOrdersClient() {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<OrderStatus | ''>(''); // '' = 전체
  const [q, setQ] = useState('');

  useEffect(() => {
    setLoading(true);
    const sp = new URLSearchParams();
    sp.set('status', status || ALL_STATUSES.join(','));
    fetch('/api/warehouse/orders?' + sp.toString(), { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setRows(j.orders ?? []))
      .finally(() => setLoading(false));
  }, [status]);

  const view = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(t) ||
        (o.customerName ?? '').toLowerCase().includes(t) ||
        (o.storeName ?? '').toLowerCase().includes(t),
    );
  }, [rows, q]);

  return (
    <div className="space-y-3">
      {/* 상태 필터(단일선택) + 검색 */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-gray-200 bg-white p-3">
        <button
          onClick={() => setStatus('')}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            status === '' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-500 hover:border-gray-400'
          }`}
        >
          전체
        </button>
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              status === s ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-500 hover:border-gray-400'
            }`}
          >
            {ORDER_STATUS_LABEL[s]}
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="주문번호 · 고객 · 가맹점 검색"
          className="ml-auto h-9 w-full rounded-lg border border-gray-300 px-3 text-sm sm:w-64"
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="whitespace-nowrap px-4 py-2.5 text-left">주문번호</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-left">상태</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-left">구분 / 고객</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-left">가맹점</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-right">품목</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-right">금액</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-left">일시</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">불러오는 중…</td></tr>
            ) : view.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">주문이 없습니다</td></tr>
            ) : (
              view.map((o) => (
                <Fragment key={o.id}>
                  <tr className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-700">{o.orderNumber}</td>
                    <td className="whitespace-nowrap px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {o.orderedByStoreId ? (
                        <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700">발주</span>
                      ) : (
                        <span className="text-gray-700">{o.customerName ?? '—'}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">{o.storeName ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-gray-600">{o.itemCount}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-gray-900">{formatKRW(o.total)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{formatDateTime(o.createdAt)}</td>
                  </tr>
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
      {!loading && (
        <p className="px-1 text-xs text-gray-400">총 {view.length.toLocaleString()}건{q ? ` (검색)` : ''}</p>
      )}
    </div>
  );
}
