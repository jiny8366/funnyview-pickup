'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { formatKRW, formatDateTime } from '@/lib/utils/format';

interface InvoiceItem {
  lensName: string;
  lensBrand: string;
  sku: string;
  eyeSide: 'left' | 'right' | 'both';
  sphere: string | null;
  cylinder: string | null;
  axis: number | null;
  addPower: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}
interface Invoice {
  order: { orderNumber: string; createdAt: string; status: string; customerName: string; customerPhone: string; customerNote: string | null };
  store: { name: string; phone: string | null; address: string; businessNumber: string | null; representativeName: string | null };
  items: InvoiceItem[];
  totals: { subtotal: number; discount: number; total: number };
  issuer: { company: string; service: string; bizNo: string; address: string; phone: string; ceo: string; issuedAt: string };
}

const EYE: Record<string, string> = { left: '좌(OS)', right: '우(OD)', both: '양안' };

function power(it: InvoiceItem): string {
  const p: string[] = [];
  if (it.sphere != null && it.sphere !== '') p.push(`SPH ${it.sphere}`);
  if (it.cylinder != null && it.cylinder !== '') p.push(`CYL ${it.cylinder}`);
  if (it.axis != null) p.push(`AX ${it.axis}`);
  if (it.addPower != null && it.addPower !== '') p.push(`ADD ${it.addPower}`);
  return p.join(' / ') || '-';
}

export default function InvoicePage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Invoice | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch(`/api/warehouse/orders/${params.id}/invoice`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch((s) => setErr(`불러오기 실패 (${s})`));
  }, [params.id]);

  if (err) return <div className="p-6 text-sm text-red-600">{err}</div>;
  if (!data) return <div className="p-6 text-sm text-gray-400">불러오는 중…</div>;

  const { order, store, items, totals, issuer } = data;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      {/* 인쇄 시 화면 크롬 숨기고 명세서만 출력 */}
      <style>{`@media print { body * { visibility: hidden !important; } .invoice-doc, .invoice-doc * { visibility: visible !important; } .invoice-doc { position: absolute; left: 0; top: 0; width: 100%; } @page { size: A4; margin: 14mm; } }`}</style>

      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-lg font-bold">거래명세서 미리보기</h1>
        <Button onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-700">🖨 인쇄 / PDF 저장</Button>
      </div>

      <div className="doc-light invoice-doc rounded-2xl border border-gray-300 bg-white p-6 text-gray-900">
        <div className="mb-4 text-center">
          <div className="text-xl font-bold tracking-wide">거 래 명 세 서</div>
          <div className="mt-1 text-xs text-gray-500">(공급받는자 보관용) · 발행 {formatDateTime(issuer.issuedAt)}</div>
        </div>

        {/* 공급자 / 공급받는자 */}
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
            <div className="mb-1 font-semibold text-gray-700">공급받는자 (픽업 가맹점)</div>
            <div className="font-bold">{store.name}</div>
            <div className="mt-1 space-y-0.5 text-gray-600">
              <div>사업자등록번호: {store.businessNumber || '—'}</div>
              <div>대표: {store.representativeName || '—'}</div>
              <div>주소: {store.address || '—'}</div>
              <div>연락처: {store.phone || '—'}</div>
            </div>
          </div>
        </div>

        {/* 주문 정보 */}
        <div className="mt-3 flex flex-wrap justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700">
          <span>주문번호 <b className="font-mono">{order.orderNumber}</b></span>
          <span>주문일 {formatDateTime(order.createdAt)}</span>
          <span>수령 고객 <b>{order.customerName}</b> {order.customerPhone}</span>
        </div>

        {/* 품목 */}
        <table className="mt-3 w-full border-collapse text-xs">
          <thead>
            <tr className="border-y border-gray-300 bg-gray-50 text-gray-600">
              <th className="px-2 py-1.5 text-left">제품 (브랜드)</th>
              <th className="px-2 py-1.5 text-left">눈 / 도수</th>
              <th className="px-2 py-1.5 text-right">수량</th>
              <th className="px-2 py-1.5 text-right">단가</th>
              <th className="px-2 py-1.5 text-right">금액</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} className="border-b border-gray-100 align-top">
                <td className="px-2 py-1.5">
                  <div className="font-medium">{it.lensName}</div>
                  <div className="text-[10px] text-gray-500">{it.lensBrand} · {it.sku}</div>
                </td>
                <td className="px-2 py-1.5">
                  <span className="font-semibold">{EYE[it.eyeSide] ?? it.eyeSide}</span>
                  <div className="text-[10px] text-gray-500">{power(it)}</div>
                </td>
                <td className="px-2 py-1.5 text-right">{it.quantity}</td>
                <td className="px-2 py-1.5 text-right">{formatKRW(it.unitPrice)}</td>
                <td className="px-2 py-1.5 text-right font-medium">{formatKRW(it.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 합계 */}
        <div className="mt-3 ml-auto w-56 space-y-1 text-xs">
          <div className="flex justify-between text-gray-600"><span>공급가액</span><span>{formatKRW(totals.subtotal)}</span></div>
          {totals.discount > 0 && (
            <div className="flex justify-between text-gray-600"><span>할인</span><span>− {formatKRW(totals.discount)}</span></div>
          )}
          <div className="flex justify-between border-t border-gray-300 pt-1 text-sm font-bold">
            <span>합계 (VAT 포함)</span><span>{formatKRW(totals.total)}</span>
          </div>
        </div>

        {order.customerNote && (
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">고객 메모: {order.customerNote}</div>
        )}
        <div className="mt-4 text-center text-[10px] text-gray-400">{issuer.company} · 본 명세서는 픽업 배송 동봉용입니다.</div>
      </div>
    </div>
  );
}
