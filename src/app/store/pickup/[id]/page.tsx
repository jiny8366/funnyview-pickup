'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { Card, CardBody } from '@/components/ui/card';
import { IconArrowLeft, IconClose, IconSearch } from '@/components/ui/icons';
import { PrescriptionManager } from '@/components/prescription/prescription-manager';
import { NotificationHistory } from '@/components/orders/notification-history';
import { parseBarcode } from '@/lib/barcode/parse';
import { formatLensDisplayName, formatPackQuantity } from '@/lib/lens/format';
import { formatDateTime, formatKRW } from '@/lib/utils/format';
import type { OrderStatus } from '@/types/order';

interface OrderItem {
  id: string;
  eyeSide: 'left' | 'right' | 'both';
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  lensName: string;
  lensBrand: string;
  sphere: string;
  cylinder: string | null;
  axis: number | null;
  addPower: string | null;
  skuSnapshot: string;
  replacementCycle: string;
  piecesPerBox: number;
  lensType: string;
}

interface OrderDetail {
  order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    total: number;
    paidAt: string | null;
    readyAt: string | null;
    completedAt: string | null;
  };
  customer: { id: string; name: string; phone: string };
  store: { id: string; name: string };
  items: OrderItem[];
}

interface ScanLog {
  id: string;
  raw: string;
  matchedItemId: string | null;
  message: string;
  ok: boolean;
  at: string;
}

const eyeLabel = (s: 'left' | 'right' | 'both') =>
  s === 'left' ? 'OS (좌)' : s === 'right' ? 'OD (우)' : '양안';

export default function StorePickupDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // 스캔 상태 — itemId → 현재 스캔 카운트
  const [scanned, setScanned] = useState<Record<string, number>>({});
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [raw, setRaw] = useState('');
  const [override, setOverride] = useState(false); // 스캔 강제 우회 모드
  const [paying, setPaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/orders/${params.id}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [data]);

  // 스캔 처리 — 클라이언트에서 항목과 매칭
  function handleScan(e: React.FormEvent) {
    e.preventDefault();
    const text = raw.trim();
    if (!text || !data) return;

    const parsed = parseBarcode(text);
    setRaw('');

    if (!parsed.di) {
      addLog(text, null, '바코드 파싱 실패: 형식 미인식', false);
      return;
    }

    // 항목과 매칭 — variantId 가 같은지 또는 SKU 가 같은지
    // (orderItems 에는 skuSnapshot 만 있고 udi_di 가 없음 — UDI 일괄 적재 후 채워질 예정)
    // 임시: SKU 끝자리 일치 또는 사용자가 'override' 모드면 임의 매칭
    const remaining = data.items.filter(
      (it) => (scanned[it.id] ?? 0) < it.quantity,
    );

    if (remaining.length === 0) {
      addLog(text, null, '이미 모든 항목 스캔 완료', false);
      return;
    }

    // SKU 매칭 시도 — DI 가 항목의 udi_di 와 일치하는지 (현재는 udi_di 가 비어있어 시도 안 함)
    // 미스매치 안내 + 우회 모드 옵션
    if (!override) {
      addLog(
        text,
        null,
        `스캔 매칭 — DB 에 udi_di 등록 후 자동 매칭됩니다. 지금은 '강제 매칭' 토글로 처리하세요. (DI: ${parsed.di})`,
        false,
      );
      return;
    }

    // 강제 모드: 남은 첫 항목에 +1
    const item = remaining[0];
    setScanned((s) => ({ ...s, [item.id]: (s[item.id] ?? 0) + 1 }));
    addLog(text, item.id, `${item.lensBrand} ${item.lensName} +1팩`, true);
  }

  function addLog(raw: string, matchedItemId: string | null, message: string, ok: boolean) {
    setLogs((p) => [
      {
        id: Math.random().toString(36).slice(2),
        raw,
        matchedItemId,
        message,
        ok,
        at: new Date().toLocaleTimeString('ko-KR'),
      },
      ...p,
    ].slice(0, 20));
  }

  function adjust(itemId: string, delta: number) {
    setScanned((s) => {
      const cur = s[itemId] ?? 0;
      const item = data?.items.find((i) => i.id === itemId);
      if (!item) return s;
      const next = Math.max(0, Math.min(item.quantity, cur + delta));
      return { ...s, [itemId]: next };
    });
  }

  function reset(itemId: string) {
    setScanned((s) => ({ ...s, [itemId]: 0 }));
  }

  async function complete(payment?: { method: 'card' | 'cash'; amount: number }) {
    if (!data) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/store/orders/${data.order.id}/transition`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'complete', payment }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? '처리 실패');
      setBusy(false);
      return;
    }
    setPaying(false);
    router.push('/store/pickup');
  }

  async function doStatusAction(action: 'no_show' | 'return') {
    if (!data) return;
    const confirmMsg =
      action === 'no_show'
        ? '미수령 처리할까요? 고객에게 미수령 안내가 발송됩니다.'
        : '반품 처리할까요? 재고는 입고 전표로 별도 재등록해야 합니다.';
    if (!window.confirm(confirmMsg)) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/store/orders/${data.order.id}/transition`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? '처리 실패');
      setBusy(false);
      return;
    }
    router.push('/store/pickup');
  }

  if (loading || !data) {
    return <div className="text-sm text-gray-400">불러오는 중...</div>;
  }

  const { order, customer, items } = data;
  const totalRequired = items.reduce((s, i) => s + i.quantity, 0);
  const totalScanned = items.reduce((s, i) => s + (scanned[i.id] ?? 0), 0);
  const allMatched = totalScanned >= totalRequired;
  const canComplete = order.status === 'ready' && allMatched;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <Link href="/store/pickup" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
          <IconArrowLeft size={16} /> 픽업 목록
        </Link>
        <StatusBadge status={order.status} />
      </header>

      {/* 주문 요약 */}
      <Card>
        <CardBody>
          <div className="font-mono text-xs text-gray-500">{order.orderNumber}</div>
          <div className="mt-1 font-semibold text-gray-900">
            {customer.name}{' '}
            <a href={`tel:${customer.phone}`} className="text-sm text-brand-600">
              {customer.phone}
            </a>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            {order.readyAt && <span>준비 {formatDateTime(order.readyAt)}</span>}
            <span className="font-semibold text-gray-900">{formatKRW(order.total)}</span>
            <span className={order.paidAt ? 'text-emerald-700' : 'text-amber-700'}>
              {order.paidAt ? '✓ 선결제 완료' : '⚠ 매장 결제 필요'}
            </span>
          </div>
        </CardBody>
      </Card>

      {/* 고객 알림 발송 이력 (클레임 대응 — 보드 #9) */}
      <NotificationHistory orderId={params.id} />

      {/* 고객 시력정보 (도수 확인·기록) */}
      <PrescriptionManager
        endpoint={`/api/store/customers/${customer.id}/prescriptions`}
        canEdit
        recommendEndpoint={`/api/store/customers/${customer.id}/recommend`}
      />

      {/* 스캔 진행 */}
      <Card>
        <CardBody>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                스캔 진행 {totalScanned}/{totalRequired} 팩
              </div>
              <div className="mt-0.5 text-xs text-gray-500">
                박스 외관의 바코드를 스캔하세요. 한 박스당 +1팩.
              </div>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={override}
                onChange={(e) => setOverride(e.target.checked)}
                className="h-4 w-4"
              />
              강제 매칭 (수기)
            </label>
          </div>

          <form onSubmit={handleScan} className="flex gap-2">
            <div className="relative flex-1">
              <IconSearch size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder="바코드 스캔 또는 입력"
                className="h-12 w-full rounded-lg border-2 border-amber-200 bg-white pl-10 pr-3 font-mono text-base focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <Button type="submit" size="lg" disabled={!raw}>
              매칭
            </Button>
          </form>

          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </CardBody>
      </Card>

      {/* 항목별 스캔 상태 */}
      <div className="space-y-2">
        {items.map((it) => {
          const sc = scanned[it.id] ?? 0;
          const done = sc >= it.quantity;
          return (
            <div
              key={it.id}
              className={`rounded-2xl border p-3 ${done ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200 bg-white'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-brand-600">{eyeLabel(it.eyeSide)}</div>
                  <div className="mt-0.5 text-sm font-medium text-gray-900">
                    {formatLensDisplayName(
                      {
                        brand: it.lensBrand,
                        name: it.lensName,
                        replacementCycle: it.replacementCycle,
                        piecesPerBox: it.piecesPerBox,
                        lensType: it.lensType,
                      },
                      it,
                      { format: 'full' },
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    <span className="text-gray-500">필요</span>
                    <span className="font-semibold text-gray-900">
                      {formatPackQuantity(it.quantity, it.piecesPerBox)}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-gray-400">{it.skuSnapshot}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div
                    className={`text-2xl font-bold ${done ? 'text-emerald-600' : sc > 0 ? 'text-amber-600' : 'text-gray-300'}`}
                  >
                    {sc}/{it.quantity}
                  </div>
                  <div className="mt-1 flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => adjust(it.id, -1)}
                      disabled={sc === 0}
                      className="grid h-7 w-7 place-items-center rounded border border-gray-200 text-sm disabled:opacity-30"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      onClick={() => adjust(it.id, 1)}
                      disabled={done}
                      className="grid h-7 w-7 place-items-center rounded border border-gray-200 text-sm disabled:opacity-30"
                    >
                      +
                    </button>
                    {sc > 0 && (
                      <button
                        type="button"
                        onClick={() => reset(it.id)}
                        className="ml-1 grid h-7 w-7 place-items-center rounded text-gray-400 hover:bg-gray-100"
                        aria-label="초기화"
                      >
                        <IconClose size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 스캔 이력 */}
      {logs.length > 0 && (
        <Card>
          <CardBody>
            <div className="mb-2 text-xs font-semibold text-gray-700">최근 스캔 ({logs.length})</div>
            <ul className="divide-y divide-gray-100 text-xs">
              {logs.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className={l.ok ? 'text-emerald-700' : 'text-amber-700'}>
                    {l.ok ? '✓' : '⚠'} {l.message}
                  </span>
                  <span className="shrink-0 font-mono text-gray-400">{l.at}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {/* 액션 */}
      <div className="sticky bottom-0 -mx-4 border-t border-gray-200 bg-white px-4 py-3 md:-mx-6 md:px-6">
        {!canComplete && order.status === 'ready' && (
          <div className="mb-2 text-center text-xs text-gray-500">
            모든 항목 스캔 매칭 후 픽업 처리 가능 ({totalScanned}/{totalRequired})
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => router.push('/store/pickup')} className="flex-1">
            목록
          </Button>
          {order.status === 'ready' && (
            <>
              {order.paidAt ? (
                <Button
                  onClick={() => complete()}
                  disabled={!canComplete || busy}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  {busy ? '처리 중...' : '픽업 완료'}
                </Button>
              ) : (
                <Button
                  onClick={() => setPaying(true)}
                  disabled={!canComplete}
                  className="flex-1 bg-amber-600 hover:bg-amber-700"
                >
                  결제 + 완료
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => doStatusAction('no_show')}
                disabled={busy}
              >
                미수령
              </Button>
            </>
          )}
          {order.status === 'no_show' && (
            <Button
              onClick={() => complete()}
              disabled={busy}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              재방문 픽업 완료
            </Button>
          )}
          {(order.status === 'no_show' || order.status === 'completed') && (
            <Button
              onClick={() => doStatusAction('return')}
              disabled={busy}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              반품 처리
            </Button>
          )}
        </div>
      </div>

      {paying && (
        <PaymentDialog
          orderNumber={order.orderNumber}
          customerName={customer.name}
          total={order.total}
          onCancel={() => setPaying(false)}
          onConfirm={(p) => complete(p)}
        />
      )}
    </div>
  );
}

function PaymentDialog({
  orderNumber,
  customerName,
  total,
  onCancel,
  onConfirm,
}: {
  orderNumber: string;
  customerName: string;
  total: number;
  onCancel: () => void;
  onConfirm: (p: { method: 'card' | 'cash'; amount: number }) => void;
}) {
  const [method, setMethod] = useState<'card' | 'cash'>('card');
  const [amount, setAmount] = useState(total);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center md:p-4">
      <div
        className="w-full max-w-md animate-slide-up bg-white p-6 shadow-pop md:animate-scale-in md:rounded-2xl"
        style={{
          borderTopLeftRadius: '1rem',
          borderTopRightRadius: '1rem',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)',
        }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300 md:hidden" />
        <h3 className="text-lg font-bold">결제 처리</h3>
        <p className="mt-1 text-sm text-gray-500">{orderNumber} · {customerName}</p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs text-gray-500">결제 수단</label>
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => setMethod('card')}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm ${method === 'card' ? 'border-amber-600 bg-amber-50' : 'border-gray-300'}`}
              >
                카드
              </button>
              <button
                type="button"
                onClick={() => setMethod('cash')}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm ${method === 'cash' ? 'border-amber-600 bg-amber-50' : 'border-gray-300'}`}
              >
                현금
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">금액</label>
            <input
              className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(Math.max(0, Number(e.target.value.replace(/\D/g, ''))))}
            />
          </div>
          <div className="text-right text-sm text-gray-500">
            주문금액: <span className="font-semibold text-gray-900">{formatKRW(total)}</span>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>취소</Button>
          <Button onClick={() => onConfirm({ method, amount })} className="bg-amber-600 hover:bg-amber-700">
            결제 + 처리완료
          </Button>
        </div>
      </div>
    </div>
  );
}
