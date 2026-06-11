'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  totalSupplyAmount: number;
  note: string | null;
  createdAt: string;
  itemCount: number;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  placed: { label: '발주접수', cls: 'bg-blue-100 text-blue-700' },
  confirmed: { label: '확인', cls: 'bg-amber-100 text-amber-700' },
  shipped: { label: '출고', cls: 'bg-emerald-100 text-emerald-700' },
  received: { label: '완료', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: '취소', cls: 'bg-gray-200 text-gray-600' },
};

export function StoreOrderHistoryClient() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/store/purchase-orders')
      .then((r) => r.json())
      .then((j) => setOrders(j.orders ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">내 발주 내역</h1>
          <p className="mt-1 text-sm text-gray-500">본사로 발주한 내역(공급가 기준)</p>
        </div>
        <Link
          href="/store/order"
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
        >
          새 발주
        </Link>
      </header>

      {loading ? (
        <p className="py-16 text-center text-sm text-gray-400">불러오는 중…</p>
      ) : orders.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-400">발주 내역이 없습니다.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3">발주번호</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3 text-right">품목</th>
                <th className="px-4 py-3 text-right">공급 금액</th>
                <th className="px-4 py-3">일시</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((o) => {
                const s = STATUS_LABEL[o.status] ?? { label: o.status, cls: 'bg-gray-100 text-gray-600' };
                return (
                  <tr key={o.id} className="bg-white">
                    <td className="px-4 py-3 font-medium text-gray-900">{o.orderNumber}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{o.itemCount}건</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {o.totalSupplyAmount.toLocaleString()}원
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(o.createdAt).toLocaleString('ko-KR')}
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
