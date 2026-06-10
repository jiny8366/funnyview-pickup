'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface Item {
  lensName: string;
  lensBrand: string;
  sku: string;
  eyeSide: 'left' | 'right' | 'both';
  sphere: string | null;
  cylinder: string | null;
  axis: number | null;
  quantity: number;
}
interface OrderDetail {
  order: { id: string; orderNumber: string; status: string; customerName: string; storeName: string };
  items: Item[];
}
interface ScanMatch { variantId: string; barcode: string; sku: string; sphere: string | null; cylinder: string | null; axis: number | null; lensName: string; lensBrand: string }

function powerOf(it: { sphere: string | null; cylinder: string | null; axis: number | null }): string {
  const p: string[] = [];
  if (it.sphere) p.push(`SPH ${it.sphere}`);
  if (it.cylinder) p.push(`CYL ${it.cylinder}`);
  if (it.axis != null) p.push(`AX ${it.axis}`);
  return p.join(' / ');
}

export default function PackingPage() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const [data, setData] = useState<OrderDetail | null>(null);
  const [err, setErr] = useState('');
  const [scanned, setScanned] = useState<Record<string, number>>({}); // sku -> count
  const [variantBySku, setVariantBySku] = useState<Record<string, string>>({});
  const [log, setLog] = useState<{ ok: boolean; text: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/warehouse/orders/${params.orderId}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch((s) => setErr(`주문을 불러오지 못했습니다 (${s})`));
  }, [params.orderId]);

  // SKU 별 주문 수량 합산(같은 제품 좌/우 합산 — 패킹은 박스 단위)
  const required = useMemo(() => {
    const m: Record<string, { qty: number; label: string; sub: string }> = {};
    for (const it of data?.items ?? []) {
      const cur = m[it.sku] ?? { qty: 0, label: `${it.lensName}`, sub: `${it.lensBrand} · ${it.sku}` };
      cur.qty += it.quantity;
      m[it.sku] = cur;
    }
    return m;
  }, [data]);

  const totalRequired = Object.values(required).reduce((s, r) => s + r.qty, 0);
  const totalScanned = Object.values(scanned).reduce((s, n) => s + n, 0);
  const allMatched = totalRequired > 0 && Object.entries(required).every(([sku, r]) => (scanned[sku] ?? 0) === r.qty);
  const canShip = data?.order.status === 'picking' && allMatched;

  const addLog = (ok: boolean, text: string) => setLog((l) => [{ ok, text }, ...l].slice(0, 8));

  const handleScan = useCallback(async (raw: string) => {
    const barcode = raw.trim();
    if (!barcode) return;
    try {
      const res = await fetch('/api/warehouse/barcode-scan', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ barcode }),
      });
      if (res.status === 404) { addLog(false, `미등록 바코드: ${barcode}`); return; }
      if (!res.ok) { addLog(false, `스캔 오류 (${res.status})`); return; }
      const { match } = (await res.json()) as { match: ScanMatch };
      const req = required[match.sku];
      if (!req) { addLog(false, `⚠ 주문에 없는 제품: ${match.lensName} (${match.sku}) — 오패킹!`); return; }
      const cur = scanned[match.sku] ?? 0;
      if (cur >= req.qty) { addLog(false, `이미 충족: ${match.lensName} (${cur}/${req.qty}) — 초과 스캔`); return; }
      setScanned((s) => ({ ...s, [match.sku]: (s[match.sku] ?? 0) + 1 }));
      setVariantBySku((v) => ({ ...v, [match.sku]: match.variantId }));
      addLog(true, `✓ ${match.lensName} ${powerOf(match)} (+1)`);
    } catch {
      addLog(false, '네트워크 오류 — 다시 스캔');
    }
  }, [required, scanned]);

  async function ship() {
    if (!data || !canShip) return;
    setBusy(true);
    const payload = Object.entries(scanned).map(([sku, count]) => ({ variantId: variantBySku[sku], count }));
    const res = await fetch(`/api/warehouse/orders/${data.order.id}/transition`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'ship', scanned: payload }),
    });
    setBusy(false);
    if (res.ok) { router.push('/warehouse/shipments'); return; }
    const j = await res.json().catch(() => ({}));
    setErr(`출고 실패: ${j.message ?? j.error ?? res.status}${res.status === 409 ? ' (서버 수량 재검증 불일치)' : ''}`);
  }

  if (err && !data) return <div className="p-6 text-sm text-red-600">{err}</div>;
  if (!data) return <div className="p-6 text-sm text-gray-400">불러오는 중…</div>;

  const { order } = data;
  const wrongStatus = order.status !== 'picking';

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <header>
        <h1 className="text-xl font-bold">패킹 검수 · 스캔</h1>
        <p className="mt-0.5 text-xs text-gray-500">
          <span className="font-mono">{order.orderNumber}</span> · {order.customerName} → {order.storeName}
        </p>
      </header>

      {wrongStatus && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          현재 상태 <b>{order.status}</b> — 패킹 검수는 <b>picking(패킹중)</b> 단계에서 진행합니다.
        </div>
      )}

      {/* 스캔 입력 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <label className="text-sm font-semibold text-gray-900">바코드 스캔</label>
        <p className="mb-2 text-xs text-gray-500">USB 스캐너로 박스 바코드를 스캔하세요(또는 입력 후 Enter).</p>
        <input
          ref={inputRef}
          autoFocus
          className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono"
          placeholder="바코드…"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const v = (e.target as HTMLInputElement).value;
              (e.target as HTMLInputElement).value = '';
              handleScan(v);
            }
          }}
          disabled={wrongStatus}
        />
        {log.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs">
            {log.map((l, i) => (
              <li key={i} className={l.ok ? 'text-emerald-700' : 'text-red-600'}>{l.text}</li>
            ))}
          </ul>
        )}
      </div>

      {/* 진행 현황 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold">검수 진행 {totalScanned}/{totalRequired} 팩</span>
          {allMatched && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">전 품목 일치 ✓</span>}
        </div>
        <ul className="divide-y divide-gray-100">
          {Object.entries(required).map(([sku, r]) => {
            const c = scanned[sku] ?? 0;
            const done = c === r.qty;
            const over = c > r.qty;
            return (
              <li key={sku} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <div className="text-sm font-medium">{r.label}</div>
                  <div className="text-[11px] text-gray-500">{r.sub}</div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${over ? 'bg-red-50 text-red-700' : done ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                  {c} / {r.qty}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      <Button onClick={ship} disabled={!canShip || busy} className="w-full bg-emerald-600 hover:bg-emerald-700">
        {busy ? '출고 처리 중…' : canShip ? '✅ 검수 완료 — 출고(배송) 처리' : '전 품목 스캔 후 출고 가능'}
      </Button>
    </div>
  );
}
