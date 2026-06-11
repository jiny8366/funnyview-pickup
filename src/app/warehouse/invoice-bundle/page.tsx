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

// 팩리스트 교차검증: 픽리스트 수량(선택 주문 item 합산) vs 팩리스트 수량(가맹점별 합산)을
// 제품+도수 키로 비교. 정상흐름에선 동일 주문ids라 일치하나, 불일치 시 ⚠️로 경고.
interface CrossCheckRow { key: string; lensName: string; power: string; pick: number; pack: number }
function buildCrossCheck(stores: BStore[]): CrossCheckRow[] {
  // 픽리스트 기준: 주문(=picklist)에 담긴 item 수량을 제품+도수로 합산
  // 팩리스트 기준: 가맹점 박스 동봉 슬립에 찍히는 수량을 제품+도수로 합산
  // 동일 데이터(stores)에서 두 관점으로 집계 → 데이터 드리프트/잘못된 선택 방어
  const pick = new Map<string, { lensName: string; power: string; qty: number }>();
  const pack = new Map<string, { lensName: string; power: string; qty: number }>();
  for (const s of stores) {
    for (const o of s.orders) {
      for (const it of o.items) {
        const k = `${it.lensBrand}|${it.lensName}|${it.sku}|${power(it)}`;
        const cur = pick.get(k) ?? { lensName: `${it.lensBrand} ${it.lensName}`, power: power(it), qty: 0 };
        cur.qty += it.quantity;
        pick.set(k, cur);
        // 팩리스트는 가맹점 박스에 동봉되는 슬립 — 같은 item 집합을 가맹점 그룹 단위로 다시 집계
        const pcur = pack.get(k) ?? { lensName: `${it.lensBrand} ${it.lensName}`, power: power(it), qty: 0 };
        pcur.qty += it.quantity;
        pack.set(k, pcur);
      }
    }
  }
  const keys = new Set([...pick.keys(), ...pack.keys()]);
  const rows: CrossCheckRow[] = [];
  for (const k of keys) {
    const p = pick.get(k);
    const q = pack.get(k);
    const pickQty = p?.qty ?? 0;
    const packQty = q?.qty ?? 0;
    if (pickQty !== packQty) {
      rows.push({ key: k, lensName: (p ?? q)!.lensName, power: (p ?? q)!.power, pick: pickQty, pack: packQty });
    }
  }
  return rows;
}

function BundleInner() {
  const sp = useSearchParams();
  const ids = (sp.get('ids') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  // 출력 분리: invoice=거래명세서 / waybill=배송송장 / packlist=박스 동봉 팩리스트 (JINY 지시 — 별도 문서)
  const rawMode = sp.get('mode');
  const mode: 'invoice' | 'waybill' | 'packlist' =
    rawMode === 'waybill' ? 'waybill' : rawMode === 'packlist' ? 'packlist' : 'invoice';
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
  const title =
    mode === 'waybill' ? '배송 송장 (가맹점 묶음)'
    : mode === 'packlist' ? '팩리스트 (박스 동봉)'
    : '거래명세서 (가맹점 묶음)';
  // 팩리스트일 때만 픽리스트 vs 팩리스트 수량 교차검증 (정상흐름=일치)
  const crossCheck = mode === 'packlist' ? buildCrossCheck(data.stores) : [];

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <style>{`@media print { body * { visibility: hidden !important; } .bundle-doc, .bundle-doc * { visibility: visible !important; } .bundle-doc { position: absolute; left: 0; top: 0; width: 100%; } .store-page { break-after: page; } .store-page:last-child { break-after: auto; } @page { size: A4; margin: 12mm; } }`}</style>

      <div className="flex items-center justify-between gap-2 print:hidden">
        <div>
          <h1 className="text-lg font-bold">{title}</h1>
          <p className="text-xs text-gray-500">{data.found}건 주문 · {data.stores.length}개 가맹점 · 발행 {formatDateTime(data.issuedAt)}</p>
          {mode === 'waybill' && (
            <p className="mt-0.5 text-[11px] text-amber-700">※ 임시 자체 양식 — 택배사 계약 확정 시 해당 택배사 송장 양식/연동으로 교체 예정</p>
          )}
          {mode === 'packlist' && (
            <p className="mt-0.5 text-[11px] text-gray-500">가맹점 박스에 동봉하는 슬립 — 제품·도수·수량·단가·금액 (거래명세서와 동일 내역).</p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* 세 문서(거래명세서/송장/팩리스트) 상호 전환 — 작업 중 액션을 잃지 않게 */}
          {mode !== 'invoice' && (
            <a href={`/warehouse/invoice-bundle?ids=${ids.join(',')}&mode=invoice`} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">🧾 거래명세서</a>
          )}
          {mode !== 'packlist' && (
            <a href={`/warehouse/invoice-bundle?ids=${ids.join(',')}&mode=packlist`} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">📦 팩리스트</a>
          )}
          {mode !== 'waybill' && (
            <a href={`/warehouse/invoice-bundle?ids=${ids.join(',')}&mode=waybill`} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">🚚 송장</a>
          )}
          <Button onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-700">🖨 인쇄 / PDF</Button>
        </div>
      </div>

      {mode === 'packlist' && crossCheck.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 print:hidden">
          <div className="font-bold">⚠️ 픽리스트와 팩리스트 수량 불일치 ({crossCheck.length}건)</div>
          <p className="mt-0.5 text-xs text-amber-700">선택한 주문 묶음의 픽리스트 수량과 박스 동봉 팩리스트 수량이 어긋납니다. 출력 전 주문 선택을 확인하세요.</p>
          <ul className="mt-2 space-y-1 text-xs">
            {crossCheck.map((r) => (
              <li key={r.key} className="flex justify-between gap-3 border-t border-amber-200 pt-1">
                <span>{r.lensName}{r.power ? ` · ${r.power}` : ''}</span>
                <span className="font-mono shrink-0">픽 {r.pick} ↔ 팩 {r.pack}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {mode === 'packlist' && crossCheck.length === 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-700 print:hidden">
          ✓ 픽리스트와 팩리스트 수량 일치 — 박스 동봉 출력 가능
        </div>
      )}

      <div className="doc-light bundle-doc space-y-6">
        {data.stores.map((s) => (
          <div key={s.store.id} className="store-page space-y-3 rounded-2xl border border-gray-300 bg-white p-6 text-gray-900">
            {mode === 'invoice' && (<>
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
            </>)}

            {mode === 'packlist' && (<>
            {/* 박스 동봉 팩리스트 — 거래명세서와 동일 내역(제품·도수·수량·단가·금액)을 박스 슬립으로 */}
            <div className="text-center text-lg font-bold tracking-wide">팩 리 스 트 <span className="text-xs font-normal text-gray-500">(박스 동봉)</span></div>
            <div className="rounded-lg border border-gray-200 p-3 text-xs">
              <div className="font-bold">{s.store.name}</div>
              <div className="mt-1 space-y-0.5 text-gray-600">
                <div>주소: {s.store.address || '—'}</div>
                <div>연락처: {s.store.phone || '—'}</div>
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
            </>)}

            {mode === 'waybill' && (
            /* 배송 송장 — 별도 출력(임시 자체 양식, 택배사 연동 전). 라벨 가독 위해 큰 글씨 */
            <div className="rounded-lg border-2 border-dashed border-gray-500 p-5">
              <div className="mb-3 text-center text-xl font-bold tracking-widest">배 송 송 장</div>
              <div className="grid grid-cols-2 gap-5 text-sm">
                <div>
                  <div className="text-xs font-semibold text-gray-500">받는 곳 (가맹점)</div>
                  <div className="mt-1 text-lg font-bold leading-snug">{s.store.name}{s.store.representativeName ? ` · ${s.store.representativeName}` : ''}</div>
                  <div className="mt-1 text-base leading-snug">{s.store.address || '—'}</div>
                  <div className="mt-0.5 text-base">☎ {s.store.phone || '—'}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-500">보내는 곳</div>
                  <div className="mt-1 font-bold">{issuer.company}</div>
                  <div className="text-gray-700">{issuer.address || '—'}</div>
                  <div className="text-gray-700">☎ {issuer.phone || '—'}</div>
                </div>
              </div>
              <div className="mt-4 border-t border-gray-300 pt-3 text-sm text-gray-800">
                내용물: 콘택트렌즈 {s.totals.quantity}팩 (주문 {s.totals.orderCount}건) · <b>취급주의</b>
              </div>
              <div className="mt-3 text-right text-[10px] text-gray-400">운송장번호: ＿＿＿＿＿＿＿＿＿＿ (택배사 발행)</div>
            </div>
            )}
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
