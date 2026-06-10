'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { formatKRW, formatDateTime } from '@/lib/utils/format';

interface BItem { lensName: string; lensBrand: string; sku: string; eyeSide: string; sphere: string | null; cylinder: string | null; axis: number | null; quantity: number; unitPrice: number; lineTotal: number }
interface BOrder { orderId: string; orderNumber: string; customerName: string; customerPhone: string; total: number; items: BItem[] }
interface BStore { store: { id: string; name: string; phone: string | null; address: string; businessNumber: string | null; representativeName: string | null }; orders: BOrder[]; totals: { orderCount: number; itemCount: number; quantity: number; amount: number } }
interface Bundle { requested: number; found: number; stores: BStore[]; issuer: { company: string; service: string; bizNo: string; ceo: string; address: string; phone: string; sealUrl: string }; issuedAt: string }

const EYE: Record<string, string> = { left: '좌', right: '우', both: '양' };
function power(it: BItem): string {
  const p: string[] = [];
  if (it.sphere) p.push(`SPH ${it.sphere}`);
  if (it.cylinder) p.push(`CYL ${it.cylinder}`);
  if (it.axis != null) p.push(`AX ${it.axis}`);
  return p.join(' / ');
}

function BundleInner() {
  const sp = useSearchParams();
  const ids = (sp.get('ids') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const [data, setData] = useState<Bundle | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (ids.length === 0) { setErr('출력할 주문이 지정되지 않았습니다 (?ids=...)'); return; }
    fetch('/api/warehouse/invoice-bundle', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderIds: ids }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch((s) => setErr(`불러오기 실패 (${s})`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  if (err) return <div className="p-6 text-sm text-red-600">{err}</div>;
  if (!data) return <div className="p-6 text-sm text-gray-400">불러오는 중…</div>;

  const { issuer } = data;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <style>{`@media print { body * { visibility: hidden !important; } .bundle-doc, .bundle-doc * { visibility: visible !important; } .bundle-doc { position: absolute; left: 0; top: 0; width: 100%; } .store-page { break-after: page; } .store-page:last-child { break-after: auto; } @page { size: A4; margin: 12mm; } }`}</style>

      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-lg font-bold">거래명세서 · 송장 (가맹점 묶음)</h1>
          <p className="text-xs text-gray-500">{data.found}건 주문 · {data.stores.length}개 가맹점 · 발행 {formatDateTime(data.issuedAt)}</p>
        </div>
        <Button onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-700">🖨 인쇄 / PDF</Button>
      </div>

      <div className="bundle-doc space-y-6">
        {data.stores.map((s) => (
          <div key={s.store.id} className="store-page space-y-3 rounded-2xl border border-gray-300 bg-white p-6 text-gray-900">
            {/* 거래명세서 */}
            <div className="text-center text-lg font-bold tracking-wide">거 래 명 세 서</div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="mb-1 font-semibold text-gray-700">공급자</div>
                <div className="font-bold">{issuer.company} <span className="font-normal text-gray-500">({issuer.service})</span></div>
                <div className="mt-1 space-y-0.5 text-gray-600">
                  <div>사업자등록번호: {issuer.bizNo || '—'}</div>
                  <div>대표: {issuer.ceo || '—'}</div>
                  <div>주소: {issuer.address || '—'}</div>
                  <div>연락처: {issuer.phone || '—'}</div>
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="mb-1 font-semibold text-gray-700">공급받는자 (가맹점)</div>
                <div className="font-bold">{s.store.name}</div>
                <div className="mt-1 space-y-0.5 text-gray-600">
                  <div>사업자등록번호: {s.store.businessNumber || '—'}</div>
                  <div>대표: {s.store.representativeName || '—'}</div>
                  <div>주소: {s.store.address || '—'}</div>
                  <div>연락처: {s.store.phone || '—'}</div>
                </div>
              </div>
            </div>

            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-y border-gray-300 bg-gray-50 text-gray-600">
                  <th className="px-2 py-1.5 text-left">주문 / 고객</th>
                  <th className="px-2 py-1.5 text-left">제품 (도수)</th>
                  <th className="px-2 py-1.5 text-right">수량</th>
                  <th className="px-2 py-1.5 text-right">단가</th>
                  <th className="px-2 py-1.5 text-right">금액</th>
                </tr>
              </thead>
              <tbody>
                {s.orders.map((o) =>
                  o.items.map((it, idx) => (
                    <tr key={`${o.orderId}-${idx}`} className="border-b border-gray-100 align-top">
                      <td className="px-2 py-1.5">
                        {idx === 0 ? (
                          <div>
                            <div className="font-mono text-[10px] text-gray-500">{o.orderNumber}</div>
                            <div className="font-medium">{o.customerName}</div>
                          </div>
                        ) : null}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="font-medium">{it.lensName} <span className="text-gray-500">[{EYE[it.eyeSide] ?? it.eyeSide}]</span></div>
                        <div className="text-[10px] text-gray-500">{it.lensBrand} · {power(it)}</div>
                      </td>
                      <td className="px-2 py-1.5 text-right">{it.quantity}</td>
                      <td className="px-2 py-1.5 text-right">{formatKRW(it.unitPrice)}</td>
                      <td className="px-2 py-1.5 text-right">{formatKRW(it.lineTotal)}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>

            <div className="ml-auto w-56 space-y-1 text-xs">
              <div className="flex justify-between text-gray-600"><span>주문 {s.totals.orderCount}건 · 총 {s.totals.quantity}팩</span></div>
              <div className="flex justify-between border-t border-gray-300 pt-1 text-sm font-bold"><span>합계 (VAT 포함)</span><span>{formatKRW(s.totals.amount)}</span></div>
            </div>

            {/* 송장 */}
            <div className="mt-4 rounded-lg border border-dashed border-gray-400 p-3 text-xs">
              <div className="mb-1 text-center text-sm font-bold">배 송 송 장</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="font-semibold text-gray-700">받는 곳 (가맹점)</div>
                  <div className="mt-0.5 font-bold">{s.store.name} {s.store.representativeName ? `· ${s.store.representativeName}` : ''}</div>
                  <div className="text-gray-600">{s.store.address || '—'}</div>
                  <div className="text-gray-600">☎ {s.store.phone || '—'}</div>
                </div>
                <div>
                  <div className="font-semibold text-gray-700">보내는 곳</div>
                  <div className="mt-0.5 font-bold">{issuer.company}</div>
                  <div className="text-gray-600">{issuer.address || '—'}</div>
                  <div className="text-gray-600">☎ {issuer.phone || '—'}</div>
                </div>
              </div>
              <div className="mt-2 border-t border-gray-200 pt-2 text-gray-700">
                내용물: 콘택트렌즈 {s.totals.quantity}팩 (주문 {s.totals.orderCount}건) · 취급주의
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function InvoiceBundlePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-400">불러오는 중…</div>}>
      <BundleInner />
    </Suspense>
  );
}
