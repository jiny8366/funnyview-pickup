'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { StatusBadge } from '@/components/ui/badge';
import { formatDateTime, formatKRW } from '@/lib/utils/format';

interface ShipmentRow {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  isPaid: number;
  createdAt: string;
  shippedAt?: string | null;
  completedAt?: string | null;
  storeName: string;
  customerName: string;
  itemCount: number;
}

interface DetailItem {
  lensName: string;
  lensBrand: string;
  sku: string;
  eyeSide: string;
  sphere: string;
  cylinder: string | null;
  axis: number | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface Detail {
  order: {
    orderNumber: string;
    status: string;
    total: number;
    isPaid: number;
    customerNote: string | null;
    customerName: string;
    customerPhone: string;
    storeName: string;
    storePhone: string;
    createdAt: string;
    shippedAt: string | null;
    arrivedAt: string | null;
    readyAt: string | null;
    completedAt: string | null;
  };
  items: DetailItem[];
  history: { fromStatus: string | null; toStatus: string; note: string | null; createdAt: string }[];
  payments: { amount: number; method: string; venue: string; status: string; paidAt: string | null }[];
}

const STATUS_PRESETS = [
  { key: 'shipped,arrived,ready,completed,no_show', label: '전체(출고 후)' },
  { key: 'shipped', label: '배송 중' },
  { key: 'arrived', label: '입고' },
  { key: 'ready', label: '픽업 준비' },
  { key: 'completed', label: '결제완료' },
  { key: 'no_show', label: '노쇼' },
];

const PAY_METHOD: Record<string, string> = {
  card: '카드', cash: '현금', bank_transfer: '계좌이체', point: '포인트', mixed: '복합',
};
const EYE: Record<string, string> = { left: '좌', right: '우', both: '양안' };

export default function WarehouseShipmentsPage() {
  const [rows, setRows] = useState<ShipmentRow[] | null>(null);
  const [statusKey, setStatusKey] = useState(STATUS_PRESETS[0].key);
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailErr, setDetailErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sp = new URLSearchParams({ status: statusKey });
    if (q.trim()) sp.set('q', q.trim());
    if (from) sp.set('from', from);
    if (to) sp.set('to', to);
    const res = await fetch('/api/warehouse/orders?' + sp.toString());
    const j = await res.json();
    setRows(j.orders ?? []);
  }, [statusKey, q, from, to]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  async function toggleDetail(id: string) {
    if (openId === id) {
      setOpenId(null);
      setDetail(null);
      return;
    }
    setOpenId(id);
    setDetail(null);
    setDetailErr(null);
    try {
      const res = await fetch(`/api/warehouse/orders/${id}`);
      if (!res.ok) throw new Error(String(res.status));
      setDetail(await res.json());
    } catch (e) {
      setDetailErr(`상세를 불러오지 못했습니다 (${e instanceof Error ? e.message : '?'})`);
    }
  }

  function payBadge(r: { status: string; isPaid: number }) {
    if (r.status === 'no_show') return <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[11px] font-medium text-rose-700">노쇼</span>;
    if (r.isPaid) return <span className="rounded bg-green-100 px-1.5 py-0.5 text-[11px] font-medium text-green-700">결제완료</span>;
    return <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">매장결제 대기</span>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">출고 관리</h1>
      <p className="text-sm text-gray-500">
        출고 이후 단계 추적 · 행을 클릭하면 상세(품목·이력·결제)가 열립니다
      </p>

      {/* 필터 바 */}
      <div className="space-y-2 rounded-2xl border border-gray-200 bg-white p-3">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_PRESETS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setStatusKey(s.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                statusKey === s.key ? 'bg-gray-900 text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="주문번호 · 고객명 · 가맹점명 검색"
            className="h-9 w-64 rounded-lg border border-gray-200 px-3 text-sm"
          />
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-lg border border-gray-200 px-2 text-sm" />
          <span className="text-gray-400">~</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-lg border border-gray-200 px-2 text-sm" />
          {(q || from || to) && (
            <button type="button" onClick={() => { setQ(''); setFrom(''); setTo(''); }} className="text-xs text-gray-400 hover:text-gray-700">
              초기화
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left">주문번호</th>
              <th className="px-3 py-2 text-left">상태</th>
              <th className="px-3 py-2 text-left">결제</th>
              <th className="px-3 py-2 text-left">고객</th>
              <th className="px-3 py-2 text-left">가맹점</th>
              <th className="px-3 py-2 text-right">금액</th>
              <th className="px-3 py-2 text-left">출고일시</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows === null ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400">불러오는 중...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-gray-400">조건에 맞는 주문이 없습니다</td></tr>
            ) : (
              rows.map((r) => (
                <Fragment key={r.id}>
                  <tr
                    onClick={() => toggleDetail(r.id)}
                    className={`cursor-pointer transition hover:bg-gray-50 ${openId === r.id ? 'bg-gray-50' : ''}`}
                  >
                    <td className="px-3 py-2 font-mono text-xs">{r.orderNumber}</td>
                    <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                    <td className="px-3 py-2">{payBadge(r)}</td>
                    <td className="px-3 py-2">{r.customerName}</td>
                    <td className="px-3 py-2">{r.storeName}</td>
                    <td className="px-3 py-2 text-right">{formatKRW(r.total)}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{r.shippedAt ? formatDateTime(r.shippedAt) : '—'}</td>
                  </tr>
                  {openId === r.id && (
                    <tr>
                      <td colSpan={7} className="bg-gray-50/70 px-4 py-3">
                        {detailErr ? (
                          <p className="text-sm text-red-600">{detailErr}</p>
                        ) : !detail ? (
                          <p className="text-sm text-gray-400">상세 불러오는 중...</p>
                        ) : (
                          <div className="grid gap-4 md:grid-cols-3">
                            <div>
                              <h3 className="text-xs font-bold uppercase text-gray-500">품목</h3>
                              <ul className="mt-1 space-y-1 text-sm">
                                {detail.items.map((it, i) => (
                                  <li key={i} className="rounded-lg border border-gray-200 bg-white px-2 py-1.5">
                                    <div className="font-medium">{it.lensName}</div>
                                    <div className="text-xs text-gray-500">
                                      {EYE[it.eyeSide] ?? it.eyeSide} · SPH {it.sphere}
                                      {it.cylinder ? ` · CYL ${it.cylinder}` : ''}
                                      {it.axis != null ? ` · AX ${it.axis}` : ''} · {it.quantity}박스 · {formatKRW(it.lineTotal)}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <h3 className="text-xs font-bold uppercase text-gray-500">처리 이력</h3>
                              <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
                                {detail.history.map((h, i) => (
                                  <li key={i}>
                                    {formatDateTime(h.createdAt)} — <StatusBadge status={h.toStatus} />
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <h3 className="text-xs font-bold uppercase text-gray-500">결제</h3>
                              {detail.payments.length === 0 ? (
                                <p className="mt-1 text-sm text-gray-400">
                                  {detail.order.isPaid ? '선결제 완료' : '결제 기록 없음 (픽업 시 매장 결제)'}
                                </p>
                              ) : (
                                <ul className="mt-1 space-y-1 text-sm">
                                  {detail.payments.map((p, i) => (
                                    <li key={i} className="rounded-lg border border-gray-200 bg-white px-2 py-1.5">
                                      <span className="font-semibold">{formatKRW(p.amount)}</span>
                                      <span className="ml-1.5 text-xs text-gray-500">
                                        {PAY_METHOD[p.method] ?? p.method} · {p.venue === 'store' ? '가맹점' : p.venue}
                                        {p.paidAt ? ` · ${formatDateTime(p.paidAt)}` : ''}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {detail.order.customerNote && (
                                <p className="mt-2 text-xs text-gray-500">메모: {detail.order.customerNote}</p>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
