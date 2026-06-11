'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PrescriptionManager } from '@/components/prescription/prescription-manager';
import { StatusBadge } from '@/components/ui/badge';
import { formatKRW } from '@/lib/utils/format';
import type { OrderStatus } from '@/types/order';

interface ItemRow {
  orderId: string;
  variantId: string;
  lensId: string | null;
  eyeSide: 'left' | 'right' | 'both';
  quantity: number;
  unitPrice: number;
  lensName: string;
  lensBrand: string;
  sphere: string | null;
  cylinder: string | null;
  axis: number | null;
  addPower: string | null;
  sku: string;
}

interface OrderRow {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  total: number;
  isPaid: number;
  createdAt: string;
  returnable: boolean;
  items: ItemRow[];
}

interface VariantOpt {
  variantId: string;
  sku: string;
  sphere: string | null;
  cylinder: string | null;
  axis: number | null;
  addPower: string | null;
  price: number;
  available: number;
}

interface ReorderLine {
  key: number;
  lensId: string | null;
  lensName: string;
  lensBrand: string;
  eyeSide: 'left' | 'right' | 'both';
  quantity: number;
  variantId: string;
  variants: VariantOpt[] | null; // null = 로딩 전
}

function doseLabel(v: { sphere: string | null; cylinder: string | null; axis: number | null; addPower: string | null }) {
  const parts: string[] = [];
  if (v.sphere) parts.push(`SPH ${v.sphere}`);
  if (v.cylinder) parts.push(`CYL ${v.cylinder}`);
  if (v.axis !== null) parts.push(`AX ${v.axis}`);
  if (v.addPower) parts.push(`ADD ${v.addPower}`);
  return parts.join(' · ') || '도수 없음';
}

const EYE_LABEL = { left: '좌', right: '우', both: '양안' } as const;

/**
 * 가맹점 고객 상세 — 예약 고객정보 확인 + 도수 확인/수정(상호 이력 기록) +
 * 배송된 제품 반품요청 + 도수 수정 후 재주문 (JINY).
 */
export default function StoreCustomerDetailPage({ params }: { params: { id: string } }) {
  const customerId = params.id;
  const [customer, setCustomer] = useState<{ name: string; phone: string } | null>(null);
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [reorderFrom, setReorderFrom] = useState<OrderRow | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/store/customers/${customerId}/orders`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        setCustomer(j?.customer ?? null);
        setOrders(j?.orders ?? []);
      })
      .catch(() => setOrders([]));
  }, [customerId]);

  useEffect(() => {
    load();
  }, [load]);

  async function requestReturn(order: OrderRow) {
    const reason = window.prompt(`${order.orderNumber} 반품 사유를 입력하세요 (예: 도수 불일치)`);
    if (reason === null) return;
    setErr(null);
    const res = await fetch(`/api/store/orders/${order.id}/transition`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'return', reason: reason || '매장 반품요청' }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      setErr(j?.message ?? '반품요청에 실패했습니다.');
      return;
    }
    setMsg(`${order.orderNumber} 반품 처리되었습니다. 도수 수정 후 재주문할 수 있습니다.`);
    setTimeout(() => setMsg(null), 4000);
    load();
  }

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <Link href="/store/customers" className="text-xs text-gray-400 hover:text-gray-700">
            ← 고객 관리
          </Link>
          <h1 className="mt-1 text-xl font-semibold md:text-2xl">
            {customer ? customer.name : '고객 상세'}
          </h1>
          {customer && <p className="mt-0.5 text-sm text-gray-500">{customer.phone}</p>}
        </div>
      </header>

      {msg && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>}
      {err && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}

      {/* 도수 관리 — 가맹점 수정 시 상호가 고객 마이페이지 이력에 남음 */}
      <PrescriptionManager
        endpoint={`/api/store/customers/${customerId}/prescriptions`}
        canEdit
        recommendEndpoint={`/api/store/customers/${customerId}/recommend`}
      />

      {/* 주문 이력 — 반품요청·재주문 */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-bold text-gray-900">우리 매장 주문 이력</h2>
        {!orders ? (
          <p className="text-sm text-gray-400">불러오는 중...</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-gray-400">주문 이력이 없습니다.</p>
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => (
              <li key={o.id} className="rounded-xl border border-gray-100 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-gray-500">{o.orderNumber}</span>
                    <StatusBadge status={o.status} />
                    <span className="text-xs text-gray-400">
                      {new Date(o.createdAt).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {o.returnable && (
                      <button
                        type="button"
                        onClick={() => requestReturn(o)}
                        className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
                      >
                        반품요청
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setReorderFrom(o)}
                      className="rounded-lg border border-gray-900 bg-gray-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-black"
                    >
                      재주문
                    </button>
                  </div>
                </div>
                <ul className="mt-2 space-y-1">
                  {o.items.map((it, i) => (
                    <li key={i} className="text-xs text-gray-600">
                      <span className="font-medium text-gray-800">
                        [{EYE_LABEL[it.eyeSide]}] {it.lensBrand} {it.lensName}
                      </span>{' '}
                      · {doseLabel(it)} · {it.quantity}개
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-right text-xs font-semibold text-gray-800">
                  {formatKRW(o.total)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {reorderFrom && (
        <ReorderModal
          customerId={customerId}
          order={reorderFrom}
          onClose={() => setReorderFrom(null)}
          onDone={(orderNumber) => {
            setReorderFrom(null);
            setMsg(`재주문이 접수되었습니다 (${orderNumber}). 매장 픽업으로 배송됩니다.`);
            setTimeout(() => setMsg(null), 5000);
            load();
          }}
        />
      )}
    </div>
  );
}

/** 재주문 모달 — 기존 주문 항목을 기반으로 도수(variant)만 바꿔 새 주문 생성. */
function ReorderModal({
  customerId,
  order,
  onClose,
  onDone,
}: {
  customerId: string;
  order: OrderRow;
  onClose: () => void;
  onDone: (orderNumber: string) => void;
}) {
  const [lines, setLines] = useState<ReorderLine[]>(
    order.items.map((it, i) => ({
      key: i,
      lensId: it.lensId,
      lensName: it.lensName,
      lensBrand: it.lensBrand,
      eyeSide: it.eyeSide,
      quantity: it.quantity,
      variantId: it.variantId,
      variants: null,
    })),
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 각 라인의 렌즈 도수(variant) 목록 로드
  useEffect(() => {
    const lensIds = [...new Set(order.items.map((it) => it.lensId).filter(Boolean))] as string[];
    lensIds.forEach((lensId) => {
      fetch(`/api/store/lenses/${lensId}/variants`)
        .then((r) => (r.ok ? r.json() : { variants: [] }))
        .then((j) =>
          setLines((prev) =>
            prev.map((l) => (l.lensId === lensId ? { ...l, variants: j.variants ?? [] } : l)),
          ),
        )
        .catch(() => {});
    });
  }, [order]);

  function patch(key: number, p: Partial<ReorderLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...p } : l)));
  }

  async function submit() {
    setErr(null);
    if (lines.length === 0) {
      setErr('주문할 항목이 없습니다.');
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/store/customers/${customerId}/reorder`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        lines: lines.map((l) => ({
          variantId: l.variantId,
          eyeSide: l.eyeSide,
          quantity: l.quantity,
        })),
      }),
    });
    setSaving(false);
    const j = await res.json().catch(() => null);
    if (!res.ok) {
      setErr(j?.message ?? '재주문에 실패했습니다.');
      return;
    }
    onDone(j.orderNumber);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="animate-scale-in flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-pop sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">재주문</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {order.orderNumber} 기준 · 도수를 변경하려면 항목별 도수를 선택하세요
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-gray-400 hover:bg-gray-100"
            aria-label="닫기"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {lines.map((l) => (
            <div key={l.key} className="rounded-xl border border-gray-100 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-900">
                  [{EYE_LABEL[l.eyeSide]}] {l.lensBrand} {l.lensName}
                </p>
                <button
                  type="button"
                  onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                  className="text-xs text-gray-400 hover:text-red-600"
                >
                  제외
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {l.variants === null ? (
                  <span className="text-xs text-gray-400">도수 목록 불러오는 중...</span>
                ) : (
                  <select
                    value={l.variantId}
                    onChange={(e) => patch(l.key, { variantId: e.target.value })}
                    className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                  >
                    {l.variants.map((v) => (
                      <option key={v.variantId} value={v.variantId} disabled={v.available <= 0}>
                        {doseLabel(v)}
                        {v.available <= 0 ? ' (품절)' : ` (재고 ${v.available})`}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="number"
                  min={1}
                  value={l.quantity}
                  onChange={(e) => patch(l.key, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                  className="w-16 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-xs"
                />
              </div>
            </div>
          ))}
          {lines.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-400">항목이 모두 제외되었습니다.</p>
          )}
          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>

        <footer className="border-t border-gray-100 px-5 py-3">
          <button
            type="button"
            onClick={submit}
            disabled={saving || lines.length === 0}
            className="press w-full rounded-xl bg-gray-900 py-3 text-sm font-bold text-white hover:bg-black disabled:opacity-50"
          >
            {saving ? '주문 생성 중...' : '재주문 생성 (매장 픽업)'}
          </button>
        </footer>
      </div>
    </div>
  );
}
