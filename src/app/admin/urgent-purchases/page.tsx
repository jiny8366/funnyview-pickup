'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDateTime } from '@/lib/utils/format';

interface Row {
  id: string;
  status: string;
  quantityShort: number;
  note: string | null;
  createdAt: string;
  resolvedAt: string | null;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  variantId: string;
  sku: string;
  sphere: string;
  cylinder: string | null;
  axis: number | null;
  lensName: string;
  lensBrand: string;
}

const STATUS_LABEL: Record<string, string> = {
  requested: '급매입 대기',
  ordered: '발주됨',
  received: '입고완료',
  cancelled: '취소',
};
const STATUS_COLOR: Record<string, string> = {
  requested: 'bg-red-100 text-red-700',
  ordered: 'bg-amber-100 text-amber-700',
  received: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};
const FILTERS = [
  { key: 'requested,ordered', label: '미해결' },
  { key: 'requested', label: '급매입 대기' },
  { key: 'ordered', label: '발주됨' },
  { key: 'received', label: '입고완료' },
  { key: 'cancelled', label: '취소' },
  { key: 'requested,ordered,received,cancelled', label: '전체' },
];

export default function UrgentPurchasesPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState(FILTERS[0].key);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/urgent-purchases?status=' + filter);
    const j = await res.json();
    setRows(j.urgentPurchases ?? []);
  }, [filter]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  async function setStatus(id: string, status: string) {
    setBusy(id);
    try {
      await fetch('/api/admin/urgent-purchases', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  function spec(r: Row) {
    let s = `SPH ${r.sphere}`;
    if (r.cylinder) s += ` · CYL ${r.cylinder}`;
    if (r.axis != null) s += ` · AX ${r.axis}`;
    return s;
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">급매입 리스트</h1>
        <p className="mt-1 text-sm text-gray-500">
          패킹 검수 중 수량 부족으로 등록된 품목 — 발주·입고 처리 후 해당 주문을 재검수·배송처리합니다
        </p>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              filter === f.key ? 'bg-gray-900 text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left">상태</th>
              <th className="px-3 py-2 text-left">제품 / 도수</th>
              <th className="px-3 py-2 text-right">부족수량</th>
              <th className="px-3 py-2 text-left">원인 주문</th>
              <th className="px-3 py-2 text-left">등록일시</th>
              <th className="px-3 py-2 text-right">처리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows === null ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">불러오는 중...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-gray-400">해당 상태의 급매입 건이 없습니다</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS_COLOR[r.status] ?? ''}`}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.lensBrand} {r.lensName}</div>
                    <div className="text-xs text-gray-500">{spec(r)} <span className="font-mono text-[10px] text-gray-400">{r.sku}</span></div>
                    {r.note && <div className="text-xs text-gray-400">메모: {r.note}</div>}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-red-700">{r.quantityShort}박스</td>
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs">{r.orderNumber}</span>
                    <div className="text-[11px] text-gray-400">주문상태 {r.orderStatus}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{formatDateTime(r.createdAt)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      {r.status === 'requested' && (
                        <>
                          <ActionBtn onClick={() => setStatus(r.id, 'ordered')} disabled={busy === r.id}>발주 처리</ActionBtn>
                          <ActionBtn onClick={() => setStatus(r.id, 'cancelled')} disabled={busy === r.id} danger>취소</ActionBtn>
                        </>
                      )}
                      {r.status === 'ordered' && (
                        <>
                          <Link
                            href="/warehouse/inbound/new"
                            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                          >
                            입고 등록 ↗
                          </Link>
                          <ActionBtn onClick={() => setStatus(r.id, 'received')} disabled={busy === r.id}>입고완료</ActionBtn>
                        </>
                      )}
                      {(r.status === 'received' || r.status === 'cancelled') && (
                        <span className="text-xs text-gray-400">{r.resolvedAt ? formatDateTime(r.resolvedAt) : ''}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        흐름: 검수 중 부족 → 급매입 등록(주문은 처리 중 유지) → 발주 처리 → 입고 등록·입고완료 → 픽업서비스에서 해당 주문 재검수 → 배송처리
      </p>
    </div>
  );
}

function ActionBtn({
  onClick,
  disabled,
  danger,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded border px-2 py-1 text-xs font-medium disabled:opacity-50 ${
        danger
          ? 'border-red-200 bg-white text-red-600 hover:bg-red-50'
          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}
