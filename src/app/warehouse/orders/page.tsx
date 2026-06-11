'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { formatKRW } from '@/lib/utils/format';
import type { OrderStatus } from '@/types/order';

interface OrderRow {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  total: number;
  createdAt: string;
  paidAt: string | null;
  customerName: string;
  customerPhone: string;
  orderedByStoreId: string | null;
  storeId: string;
  storeName: string;
  itemCount: number;
}

/** 가맹점 B2B 발주 (store_orders) — 고객 픽업주문과 별도 흐름, 목록에는 함께 노출 (JINY) */
interface PoRow {
  id: string;
  orderNumber: string;
  status: 'placed' | 'confirmed' | 'shipped' | 'received' | 'cancelled';
  totalSupplyAmount: number;
  createdAt: string;
  storeId: string;
  storeName: string;
  itemCount: number;
}

const PO_STATUS_LABEL: Record<PoRow['status'], string> = {
  placed: '발주접수',
  confirmed: '발주확인',
  shipped: '배송중',
  received: '입고완료',
  cancelled: '취소',
};

/** 발주 행의 다음 처리 액션 (placed→confirmed→shipped) */
function poNextAction(status: PoRow['status']): { to: PoRow['status']; label: string } | null {
  if (status === 'placed') return { to: 'confirmed', label: '발주 확인' };
  if (status === 'confirmed') return { to: 'shipped', label: '배송 처리' };
  return null;
}

export default function WarehouseOrdersPage() {
  return (
    <Suspense fallback={null}>
      <WarehouseOrdersInner />
    </Suspense>
  );
}

function WarehouseOrdersInner() {
  const router = useRouter();
  const params = useSearchParams();
  const statusFilter = params.get('status');
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [pos, setPos] = useState<PoRow[]>([]); // 가맹점 B2B 발주
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [storeFilter, setStoreFilter] = useState(''); // 픽업가맹점 필터 (업무편의 — JINY)

  // 현재 목록에 존재하는 가맹점만 드롭다운에 노출 (고객주문 + 발주 모두)
  const storeOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of orders ?? []) m.set(o.storeId, o.storeName);
    for (const p of pos) m.set(p.storeId, p.storeName);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'ko'));
  }, [orders, pos]);

  // 가맹점 필터 (전체 = 서버 순서: 최신순 유지)
  const visible = useMemo(() => {
    if (!orders) return null;
    return storeFilter ? orders.filter((o) => o.storeId === storeFilter) : orders;
  }, [orders, storeFilter]);

  const visiblePos = useMemo(
    () => (storeFilter ? pos.filter((p) => p.storeId === storeFilter) : pos),
    [pos, storeFilter],
  );

  const load = useCallback(async () => {
    const q = statusFilter ? `?status=${statusFilter}` : '';
    const [res, poRes] = await Promise.all([
      fetch('/api/warehouse/orders' + q),
      // 발주는 기본 화면(신규 처리 대기)에서만 함께 노출 — 상태필터 시 고객주문만
      statusFilter ? Promise.resolve(null) : fetch('/api/warehouse/store-orders'),
    ]);
    const json = await res.json();
    setOrders(json.orders ?? []);
    if (poRes) {
      const poJson = await poRes.json().catch(() => null);
      setPos(poJson?.orders ?? []);
    } else {
      setPos([]);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
    const t = setInterval(load, 8_000);
    return () => clearInterval(t);
  }, [load]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // 발주 전이 (확인/배송) — 고객주문 batch 와 별도 흐름
  async function poTransition(po: PoRow, to: PoRow['status']) {
    setError(null);
    const res = await fetch('/api/warehouse/store-orders', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: po.id, status: to }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      setError(`발주 ${po.orderNumber} 처리 실패${j?.error ? ` (${j.error})` : ''}`);
    }
    load();
  }

  async function batch(action: 'accept' | 'pick' | 'ship' | 'cancel') {
    if (selected.size === 0) return;
    setError(null);
    const ids = Array.from(selected);
    const results = await Promise.allSettled(
      ids.map((id) =>
        fetch(`/api/warehouse/orders/${id}/transition`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action }),
        }).then((r) => (r.ok ? null : r.json())),
      ),
    );
    const failed = results.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && r.value));
    if (failed.length > 0) {
      // API 가 내려준 사유(예: FIFO 로트 없음·재고부족)를 운영자에게 그대로 노출 — 해결경로 안내
      const firstMsg = failed
        .map((r) => (r.status === 'fulfilled' ? (r.value as { message?: string } | null)?.message : null))
        .find(Boolean);
      setError(firstMsg ? `${failed.length}건 처리 실패 — ${firstMsg}` : `${failed.length}건 처리 실패`);
    }
    setSelected(new Set());
    // 패킹 시작이 성공하면 픽리스트 화면으로 이동(거기서 픽킹·출고 진행).
    if (action === 'pick' && failed.length === 0) {
      router.push('/warehouse/picklist');
      return;
    }
    load();
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-xl font-bold md:text-2xl">
          주문 처리{statusFilter ? ` (${statusFilter})` : ''}
        </h1>
        <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 scrollbar-hide">
          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="h-9 shrink-0 rounded-lg border border-gray-200 bg-white px-2 text-sm"
          >
            <option value="">픽업가맹점 전체</option>
            {storeOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <Button variant="secondary" size="sm" onClick={() => batch('pick')} disabled={selected.size === 0}>
            패킹 시작
          </Button>
          <Button variant="danger" size="sm" onClick={() => batch('cancel')} disabled={selected.size === 0}>
            취소
          </Button>
        </div>
      </header>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* 모바일: 카드 리스트 */}
      <ul className="space-y-2 md:hidden">
        {/* 가맹점 B2B 발주 — 고객명 자리는 '발주', 배송지는 가맹점 (JINY) */}
        {visiblePos.map((p) => {
          const act = poNextAction(p.status);
          return (
            <li key={p.id} className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono text-xs text-gray-500">{p.orderNumber}</div>
                <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-700">
                  {PO_STATUS_LABEL[p.status]}
                </span>
              </div>
              <div className="mt-1 font-medium">
                <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-semibold text-indigo-700">발주</span>
              </div>
              <div className="mt-0.5 text-xs text-gray-500">→ {p.storeName}</div>
              <div className="mt-1 flex items-center justify-between text-xs">
                {act ? (
                  <button
                    type="button"
                    onClick={() => poTransition(p, act.to)}
                    className="rounded-lg bg-indigo-600 px-2.5 py-1 font-medium text-white hover:bg-indigo-700"
                  >
                    {act.label}
                  </button>
                ) : (
                  <span />
                )}
                <span className="font-semibold">{formatKRW(p.totalSupplyAmount)} · 수량 {p.itemCount}</span>
              </div>
            </li>
          );
        })}
        {visible?.map((o) => (
          <li
            key={o.id}
            onClick={() => toggle(o.id)}
            className={`rounded-2xl border bg-white p-3 ${
              selected.has(o.id) ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200'
            }`}
          >
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={selected.has(o.id)}
                onChange={() => toggle(o.id)}
                onClick={(e) => e.stopPropagation()}
                className="mt-1 h-5 w-5"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono text-xs text-gray-500">{o.orderNumber}</div>
                  <StatusBadge status={o.status} />
                </div>
                <div className="mt-1 font-medium">
                  {/* 가맹점 발주 주문은 고객명 대신 '발주' (JINY) — 배송지는 동일하게 가맹점 */}
                  {o.orderedByStoreId ? (
                    <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-semibold text-indigo-700">발주</span>
                  ) : (
                    <>
                      {o.customerName}{' '}
                      <span className="text-xs text-gray-500">{o.customerPhone}</span>
                    </>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-gray-500">→ {o.storeName}</div>
                <div className="mt-1 flex items-center justify-end text-xs">
                  <span className="font-semibold">{formatKRW(o.total)} · 수량 {o.itemCount}</span>
                </div>
              </div>
            </div>
          </li>
        ))}
        {visible && visible.length === 0 && visiblePos.length === 0 && (
          <li className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-400">
            처리할 주문이 없습니다
          </li>
        )}
      </ul>

      {/* 데스크탑: 테이블 */}
      <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white md:block">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left w-8">
                <input
                  type="checkbox"
                  checked={(visible?.length ?? 0) > 0 && selected.size === (visible?.length ?? 0)}
                  onChange={(e) => {
                    if (e.target.checked) setSelected(new Set(visible?.map((o) => o.id) ?? []));
                    else setSelected(new Set());
                  }}
                />
              </th>
              <th className="px-3 py-2 text-left">주문번호</th>
              <th className="px-3 py-2 text-left">상태</th>
              <th className="px-3 py-2 text-left">고객</th>
              <th className="px-3 py-2 text-left">픽업가맹점</th>
              <th className="px-3 py-2 text-right">금액</th>
              <th className="px-3 py-2 text-right">수량</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visiblePos.map((p) => {
              const act = poNextAction(p.status);
              return (
                <tr key={p.id} className="bg-indigo-50/40">
                  <td className="px-3 py-2">
                    {act && (
                      <button
                        type="button"
                        onClick={() => poTransition(p, act.to)}
                        className="rounded-lg bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-700"
                      >
                        {act.label}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{p.orderNumber}</td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-700">
                      {PO_STATUS_LABEL[p.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-semibold text-indigo-700">발주</span>
                  </td>
                  <td className="px-3 py-2">{p.storeName}</td>
                  <td className="px-3 py-2 text-right">{formatKRW(p.totalSupplyAmount)}</td>
                  <td className="px-3 py-2 text-right">{p.itemCount}</td>
                </tr>
              );
            })}
            {visible?.map((o) => (
              <tr key={o.id} className={selected.has(o.id) ? 'bg-emerald-50' : ''}>
                <td className="px-3 py-2">
                  <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} />
                </td>
                <td className="px-3 py-2 font-mono text-xs">{o.orderNumber}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={o.status} />
                </td>
                <td className="px-3 py-2">
                  {o.orderedByStoreId ? (
                    <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-semibold text-indigo-700">발주</span>
                  ) : (
                    <>
                      <div>{o.customerName}</div>
                      <div className="text-xs text-gray-500">{o.customerPhone}</div>
                    </>
                  )}
                </td>
                <td className="px-3 py-2">{o.storeName}</td>
                <td className="px-3 py-2 text-right">{formatKRW(o.total)}</td>
                <td className="px-3 py-2 text-right">{o.itemCount}</td>
              </tr>
            ))}
            {visible && visible.length === 0 && visiblePos.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-gray-400">
                  처리할 주문이 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
