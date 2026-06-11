'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { powerLabel } from '../variant-picker';

interface OrderItem {
  brand: string | null;
  productName: string | null;
  sphere: string | null;
  cylinder: string | null;
  axis: number | null;
  addPower: string | null;
  quantity: number;
  unitSupplyPrice: number;
  lineTotal: number;
}

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  totalSupplyAmount: number;
  note: string | null;
  createdAt: string;
  itemCount: number;
  items: OrderItem[];
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  placed: { label: '발주접수', cls: 'bg-blue-100 text-blue-700' },
  confirmed: { label: '주문접수', cls: 'bg-amber-100 text-amber-700' },
  shipped: { label: '배송중', cls: 'bg-emerald-100 text-emerald-700' },
  received: { label: '입고완료', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: '취소', cls: 'bg-gray-200 text-gray-600' },
};

export function StoreOrderHistoryClient() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    fetch('/api/store/purchase-orders')
      .then((r) => r.json())
      .then((j) => setOrders(j.orders ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  // 매장 '수령 확인' — 본사 배송(shipped) 발주를 실물 수령 처리(received)
  async function receive(id: string) {
    if (typeof window !== 'undefined' && !window.confirm('이 발주를 수령 확인할까요? (배송 물품 도착 확인)')) {
      return;
    }
    setBusy(id);
    try {
      const res = await fetch('/api/store/purchase-orders', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) load();
    } finally {
      setBusy(null);
    }
  }

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
                const open = expanded === o.id;
                return (
                  <Fragment key={o.id}>
                    <tr
                      className="cursor-pointer bg-white hover:bg-gray-50"
                      onClick={() => setExpanded(open ? null : o.id)}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <span className="mr-1 inline-block text-gray-400">{open ? '▾' : '▸'}</span>
                        {o.orderNumber}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
                          {o.status === 'shipped' && (
                            <button
                              type="button"
                              disabled={busy === o.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                receive(o.id);
                              }}
                              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {busy === o.id ? '처리 중…' : '수령 확인'}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{o.itemCount}건</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {o.totalSupplyAmount.toLocaleString()}원
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(o.createdAt).toLocaleString('ko-KR')}
                      </td>
                    </tr>
                    {open && (
                      <tr className="bg-gray-50">
                        <td colSpan={5} className="px-4 py-3">
                          {o.items.length === 0 ? (
                            <p className="text-xs text-gray-400">품목 정보가 없습니다.</p>
                          ) : (
                            <ul className="space-y-1.5">
                              {o.items.map((it, i) => {
                                const power = powerLabel(it);
                                return (
                                  <li key={i} className="flex items-center justify-between gap-3 text-xs">
                                    <div className="min-w-0">
                                      <span className="font-medium text-gray-900">{it.productName ?? '—'}</span>
                                      {it.brand && <span className="ml-1 text-gray-400">{it.brand}</span>}
                                      <span className="ml-2 font-medium text-amber-700">
                                        {power || '단일도수'}
                                      </span>
                                    </div>
                                    <span className="shrink-0 text-gray-600">
                                      {it.quantity}개 · {it.lineTotal.toLocaleString()}원
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
