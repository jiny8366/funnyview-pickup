'use client';

import { useCallback, useEffect, useState } from 'react';

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  totalSupplyAmount: number;
  note: string | null;
  createdAt: string;
  storeId: string;
  storeName: string | null;
  storeCode: string | null;
  itemCount: number;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  placed: { label: '발주접수', cls: 'bg-blue-100 text-blue-700' },
  confirmed: { label: '주문접수', cls: 'bg-amber-100 text-amber-700' },
  shipped: { label: '배송중', cls: 'bg-emerald-100 text-emerald-700' },
  received: { label: '입고완료', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: '취소', cls: 'bg-gray-200 text-gray-600' },
};

// 상태별 가능한 다음 액션
const NEXT_ACTIONS: Record<string, { status: string; label: string; danger?: boolean }[]> = {
  placed: [
    { status: 'confirmed', label: '접수' },
    { status: 'cancelled', label: '취소', danger: true },
  ],
  confirmed: [
    { status: 'shipped', label: '배송' },
    { status: 'cancelled', label: '취소', danger: true },
  ],
  shipped: [
    { status: 'received', label: '입고완료' },
    { status: 'cancelled', label: '취소', danger: true },
  ],
  received: [],
  cancelled: [],
};

const FILTERS = [
  { key: '', label: '전체' },
  { key: 'placed', label: '발주접수' },
  { key: 'confirmed', label: '주문접수' },
  { key: 'shipped', label: '배송중' },
  { key: 'received', label: '입고완료' },
  { key: 'cancelled', label: '취소' },
];

export function AdminStoreOrdersClient() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = filter ? `?status=${filter}` : '';
    const j = await fetch(`/api/admin/store-orders${qs}`).then((r) => r.json());
    setOrders(j.orders ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function transition(id: string, status: string) {
    setBusyId(id);
    try {
      const res = await fetch('/api/admin/store-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) await load();
      else {
        const j = await res.json().catch(() => ({}));
        alert(j?.error === 'INVALID_TRANSITION' ? '허용되지 않는 상태 전이입니다.' : '처리에 실패했습니다.');
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              filter === f.key
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-300 text-gray-600 hover:border-gray-400'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-gray-400">불러오는 중…</p>
      ) : orders.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-400">발주 내역이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3">가맹점</th>
                <th className="px-4 py-3">발주번호</th>
                <th className="px-4 py-3 text-right">품목</th>
                <th className="px-4 py-3 text-right">공급 금액</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">일시</th>
                <th className="px-4 py-3">처리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((o) => {
                const s = STATUS_LABEL[o.status] ?? { label: o.status, cls: 'bg-gray-100 text-gray-600' };
                const actions = NEXT_ACTIONS[o.status] ?? [];
                return (
                  <tr key={o.id} className="bg-white align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{o.storeName ?? '—'}</p>
                      {o.storeCode && <p className="text-xs text-gray-400">{o.storeCode}</p>}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-700">
                      {o.orderNumber}
                      {o.note && <p className="mt-0.5 text-xs font-normal text-gray-400">{o.note}</p>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{o.itemCount}건</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {o.totalSupplyAmount.toLocaleString()}원
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{new Date(o.createdAt).toLocaleString('ko-KR')}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {actions.length === 0 ? (
                          <span className="text-xs text-gray-300">—</span>
                        ) : (
                          actions.map((a) => (
                            <button
                              key={a.status}
                              disabled={busyId === o.id}
                              onClick={() => transition(o.id, a.status)}
                              className={`rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
                                a.danger
                                  ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                  : 'bg-gray-900 text-white hover:bg-gray-700'
                              }`}
                            >
                              {a.label}
                            </button>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
