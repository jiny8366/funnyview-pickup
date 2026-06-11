'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface ReqItem {
  variantId: string;
  sku: string;
  lensName: string;
  lensBrand: string;
  sphere: string | null;
  cylinder: string | null;
  axis: number | null;
  quantity: number;
}
interface OrderItem {
  orderId: string;
  variantId: string;
  sku: string;
  lensName: string;
  lensBrand: string;
  eyeSide: 'left' | 'right' | 'both';
  sphere: string | null;
  cylinder: string | null;
  axis: number | null;
  quantity: number;
}
interface OrderRow {
  id: string;
  orderNumber: string;
  customerName: string;
  items: OrderItem[];
}
interface StoreData {
  store: { id: string; name: string; phone: string | null; address: string | null };
  orders: OrderRow[];
  orderIds: string[];
  required: ReqItem[];
}
interface ScanMatch {
  variantId: string;
  barcode: string;
  sku: string;
  sphere: string | null;
  cylinder: string | null;
  axis: number | null;
  lensName: string;
  lensBrand: string;
}

function powerOf(it: { sphere: string | null; cylinder: string | null; axis: number | null }): string {
  const p: string[] = [];
  if (it.sphere) p.push(`SPH ${it.sphere}`);
  if (it.cylinder) p.push(`CYL ${it.cylinder}`);
  if (it.axis != null) p.push(`AX ${it.axis}`);
  return p.join(' / ') || '단일도수';
}

export default function StorePackingPage() {
  const params = useParams<{ storeId: string }>();
  const router = useRouter();
  const [data, setData] = useState<StoreData | null>(null);
  const [err, setErr] = useState('');
  const [scanned, setScanned] = useState<Record<string, number>>({}); // variantId -> count
  const [log, setLog] = useState<{ ok: boolean; text: string }[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/warehouse/packing/store/${params.storeId}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch((s) => setErr(`가맹점 팩킹 정보를 불러오지 못했습니다 (${s})`));
  }, [params.storeId]);

  // variant 단위 필요 수량 맵
  const required = useMemo(() => {
    const m: Record<string, ReqItem> = {};
    for (const r of data?.required ?? []) m[r.variantId] = r;
    return m;
  }, [data]);

  const totalRequired = Object.values(required).reduce((s, r) => s + r.quantity, 0);
  const totalScanned = Object.values(scanned).reduce((s, n) => s + n, 0);
  const allMatched =
    totalRequired > 0 && Object.values(required).every((r) => (scanned[r.variantId] ?? 0) === r.quantity);

  const addLog = (ok: boolean, text: string) => setLog((l) => [{ ok, text }, ...l].slice(0, 10));

  const handleScan = useCallback(
    async (raw: string) => {
      const barcode = raw.trim();
      if (!barcode || confirmed) return;
      try {
        const res = await fetch('/api/warehouse/barcode-scan', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ barcode }),
        });
        if (res.status === 404) {
          addLog(false, `미등록 바코드: ${barcode}`);
          return;
        }
        if (!res.ok) {
          addLog(false, `스캔 오류 (${res.status})`);
          return;
        }
        const { match } = (await res.json()) as { match: ScanMatch };
        const req = required[match.variantId];
        if (!req) {
          addLog(false, `⚠ 이 가맹점 발주에 없는 제품: ${match.lensName} (${match.sku}) — 오패킹!`);
          return;
        }
        const cur = scanned[match.variantId] ?? 0;
        if (cur >= req.quantity) {
          addLog(false, `이미 충족: ${match.lensName} (${cur}/${req.quantity}) — 초과 스캔`);
          return;
        }
        setScanned((s) => ({ ...s, [match.variantId]: (s[match.variantId] ?? 0) + 1 }));
        addLog(true, `✓ ${match.lensName} ${powerOf(match)} (+1)`);
      } catch {
        addLog(false, '네트워크 오류 — 다시 스캔');
      }
    },
    [required, scanned, confirmed],
  );

  async function ship() {
    if (!data || !confirmed) return;
    setBusy(true);
    const payload = Object.entries(scanned).map(([variantId, count]) => ({ variantId, count }));
    const res = await fetch('/api/warehouse/orders/batch-ship', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderIds: data.orderIds, scanned: payload }),
    });
    setBusy(false);
    if (res.ok) {
      router.push('/warehouse/picklist?shipped=' + encodeURIComponent(`${data.store.name} ${data.orderIds.length}건`));
      return;
    }
    const j = await res.json().catch(() => ({}));
    setErr(`배송 처리 실패: ${j.message ?? j.error ?? res.status}${res.status === 409 ? ' (서버 수량 재검증 불일치)' : ''}`);
  }

  // 전 품목 일괄 확정(스캔 생략) — 실물 수량을 눈으로 확인한 경우. required 기준 scanned 일괄 채움.
  // (M1 단건 검수화면과 동일 패턴) 서버 batch-ship 가 합계를 재검증하므로 안전.
  function fillAll() {
    if (confirmed) return;
    if (typeof window !== 'undefined' && !window.confirm('바코드 스캔을 생략하고 전 품목을 발주 수량대로 일괄 확정합니다. 실물 수량을 직접 확인하셨습니까?')) return;
    const next: Record<string, number> = {};
    for (const r of Object.values(required)) next[r.variantId] = r.quantity;
    setScanned(next);
  }

  if (err && !data) return <div className="p-6 text-sm text-red-600">{err}</div>;
  if (!data) return <div className="p-6 text-sm text-gray-400">불러오는 중…</div>;

  const invoiceHref = `/warehouse/invoice-bundle?ids=${data.orderIds.join(',')}&mode=invoice`;
  const waybillHref = `/warehouse/invoice-bundle?ids=${data.orderIds.join(',')}&mode=waybill`;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div>
        <Link href="/warehouse/picklist" className="text-sm text-gray-500 hover:text-gray-700">
          ← 배송준비중
        </Link>
      </div>
      <header>
        <h1 className="text-xl font-bold">🏪 {data.store.name} — 팩킹 검수</h1>
        <p className="mt-0.5 text-xs text-gray-500">
          전표 {data.orders.length}건 · {totalRequired}팩{data.store.phone ? ` · ☎ ${data.store.phone}` : ''}
        </p>
        <p className="mt-1 text-xs text-gray-400">
          픽업한 실물 바코드를 모두 스캔해 발주 수량과 일치하면 <b>확정</b> → 거래명세서 동봉 → 배송 처리.
        </p>
      </header>

      {data.orders.length === 0 ? (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">배송준비중(picking) 전표가 없습니다.</div>
      ) : (
        <>
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
              disabled={confirmed}
            />
            {log.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs">
                {log.map((l, i) => (
                  <li key={i} className={l.ok ? 'text-emerald-700' : 'text-red-600'}>
                    {l.text}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 집계 진행 (한 박스 = 가맹점 전체 전표 합산) */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold">
                검수 진행 {totalScanned}/{totalRequired} 팩
              </span>
              {allMatched && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">전 품목 일치 ✓</span>
              )}
            </div>
            <ul className="divide-y divide-gray-100">
              {Object.values(required).map((r) => {
                const c = scanned[r.variantId] ?? 0;
                const done = c === r.quantity;
                const over = c > r.quantity;
                return (
                  <li key={r.variantId} className="flex items-center justify-between gap-3 py-2">
                    <div>
                      <div className="text-sm font-medium">{r.lensName}</div>
                      <div className="text-[11px] text-gray-500">
                        {r.lensBrand} · {powerOf(r)} · {r.sku}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        over ? 'bg-red-50 text-red-700' : done ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {c} / {r.quantity}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* 묶인 전표 목록 (참고) */}
          <details className="rounded-2xl border border-gray-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-semibold text-gray-700">
              묶인 전표 {data.orders.length}건 (참고)
            </summary>
            <ul className="mt-2 space-y-1 text-xs text-gray-600">
              {data.orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2">
                  <span>
                    <span className="font-mono">{o.orderNumber}</span> · {o.customerName} ({o.items.reduce((s, it) => s + it.quantity, 0)}팩)
                  </span>
                  {/* 부족분 급매입 등 개별 처리 필요 시 단건 검수 화면 */}
                  <Link href={`/warehouse/packing/${o.id}`} className="text-gray-400 hover:text-gray-600 underline">
                    단건
                  </Link>
                </li>
              ))}
            </ul>
          </details>

          {err && <p className="text-sm text-red-600">{err}</p>}

          {/* 확정 → 거래명세서·송장 동봉/출력 → 배송 */}
          {!confirmed ? (
            <div className="space-y-2">
              <Button
                onClick={() => setConfirmed(true)}
                disabled={!allMatched}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                {allMatched ? '✅ 확정 (수량 일치)' : '전 품목 스캔 후 확정 가능'}
              </Button>
              {/* 스캔 생략 일괄 확정 — 실물 수량 직접 확인 시(단건 검수화면과 동일 패턴) */}
              {!allMatched && (
                <button
                  type="button"
                  onClick={fillAll}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  ✓ 전품목 확정 (스캔 생략)
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-800">
                ✅ 확정됨 — 거래명세서·송장을 출력해 박스에 동봉한 뒤 배송 처리하세요.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link
                  href={invoiceHref}
                  target="_blank"
                  className="inline-flex flex-1 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
                >
                  🧾 거래명세서 출력·동봉
                </Link>
                <Link
                  href={waybillHref}
                  target="_blank"
                  className="inline-flex flex-1 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
                >
                  🚚 송장 출력
                </Link>
              </div>
              <div className="flex">
                <Button onClick={ship} disabled={busy} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                  {busy ? '배송 처리 중…' : '🚚 배송 처리 (출고 확정)'}
                </Button>
              </div>
              <button
                type="button"
                onClick={() => setConfirmed(false)}
                className="text-xs text-emerald-600 hover:text-emerald-800"
                disabled={busy}
              >
                ← 확정 취소 (다시 스캔)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
