'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Barcode } from '@/components/warehouse/barcode';
import { formatLensDisplayName } from '@/lib/lens/format';
import { formatDateTime } from '@/lib/utils/format';

interface PickItem {
  id: string;
  eyeSide: 'left' | 'right' | 'both';
  quantity: number;
  lensName: string;
  lensBrand: string;
  sphere: string;
  cylinder: string | null;
  axis: number | null;
  addPower: string | null;
  skuSnapshot: string;
  barcode: string | null;
  replacementCycle: string;
  piecesPerBox: number;
  lensType: string;
}

interface PicklistData {
  generatedAt: string;
  orders: Array<{
    id: string;
    orderNumber: string;
    storeName: string;
    storePhone: string;
    storeAddress: string | null;
    customerName: string;
    customerPhone: string;
    items: PickItem[];
  }>;
  skuTotals: Array<{
    sku: string;
    lensName: string;
    lensBrand: string;
    replacementCycle: string;
    piecesPerBox: number;
    lensType: string;
    quantity: number;
  }>;
}

function groupByStore<T extends { storeName: string }>(list: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const o of list) {
    const arr = map.get(o.storeName) ?? [];
    arr.push(o);
    map.set(o.storeName, arr);
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'ko-KR'));
}

/** 픽리스트 미리보기/인쇄 — 자식창 전용 (JINY 확정 UX: 닫으면 배송준비 화면 그대로). */
function PicklistPrintInner() {
  const sp = useSearchParams();
  const ids = (sp.get('ids') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const autoprint = sp.get('autoprint') === '1';
  const [data, setData] = useState<PicklistData | null>(null);
  const [err, setErr] = useState('');
  const [pickedSkus, setPickedSkus] = useState<Set<string>>(new Set()); // 피킹 완료 체크(화면용)
  const [isChild, setIsChild] = useState(false);

  useEffect(() => {
    setIsChild(typeof window !== 'undefined' && !!window.opener);
  }, []);

  useEffect(() => {
    if (ids.length === 0) { setErr('출력할 주문이 지정되지 않았습니다 (?ids=...)'); return; }
    fetch('/api/warehouse/picklist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderIds: ids }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch((s) => setErr(`불러오기 실패 (${s})`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  useEffect(() => {
    if (!autoprint || !data) return;
    const t = setTimeout(() => window.print(), 600); // 바코드 렌더 후 인쇄
    return () => clearTimeout(t);
  }, [autoprint, data]);

  function togglePicked(sku: string) {
    setPickedSkus((p) => {
      const n = new Set(p);
      n.has(sku) ? n.delete(sku) : n.add(sku);
      return n;
    });
  }

  if (err) return <div className="p-6 text-sm text-red-600">{err}</div>;
  if (!data) return <div className="p-6 text-sm text-gray-400">불러오는 중…</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <style>{`@media print { body * { visibility: hidden !important; } .pick-doc, .pick-doc * { visibility: visible !important; } .pick-doc { position: absolute; left: 0; top: 0; width: 100%; } @page { size: A4; margin: 12mm; } }`}</style>

      <div className="flex items-center justify-between gap-2 print:hidden">
        <div>
          <h1 className="text-lg font-bold">픽리스트</h1>
          <p className="text-xs text-gray-500">
            생성 {formatDateTime(data.generatedAt)} · {data.orders.length}개 주문
          </p>
        </div>
        <Button onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-700">🖨 인쇄 / PDF</Button>
      </div>

      {/* 다음 단계 안내 — 자식창이면 닫기 중심 */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-800 print:hidden">
        {isChild ? (
          <>
            <span>🖨 인쇄를 마쳤으면 <b>이 창을 닫으세요</b> — 배송준비 화면에서 <b>📦 팩킹확정</b>으로 이어집니다.</span>
            <button
              type="button"
              onClick={() => window.close()}
              className="press ml-auto rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              ✕ 창 닫기
            </button>
          </>
        ) : (
          <span>다음 단계: 픽리스트 인쇄 → <b>배송준비 화면에서 📦 팩킹확정</b> → 검수 → 명세서·송장 → 배송</span>
        )}
      </div>

      <div className="pick-doc doc-light space-y-6 rounded-2xl bg-white p-4">
        <section>
          <h3 className="mb-2 text-sm font-semibold">
            SKU 합산 (피킹) · 완료 {pickedSkus.size}/{data.skuTotals.length}
          </h3>
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-center w-10 print:hidden">피킹</th>
                <th className="px-3 py-2 text-left">제품 (브랜드 / 제품명)</th>
                <th className="px-3 py-2 text-right">총 수량</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.skuTotals.map((t) => (
                <tr key={t.sku} className={pickedSkus.has(t.sku) ? 'bg-emerald-50 text-gray-400 line-through' : ''}>
                  <td className="px-3 py-2 text-center print:hidden">
                    <input type="checkbox" checked={pickedSkus.has(t.sku)} onChange={() => togglePicked(t.sku)} aria-label="피킹 완료" />
                  </td>
                  <td className="px-3 py-2">
                    {formatLensDisplayName(
                      {
                        brand: t.lensBrand,
                        name: t.lensName,
                        replacementCycle: t.replacementCycle,
                        piecesPerBox: t.piecesPerBox,
                        lensType: t.lensType,
                      },
                      { sku: t.sku, sphere: '0', cylinder: null, axis: null, addPower: null },
                      { format: 'compact' },
                    ).replace(/ \/ SPH \+0\.00$/, '')}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="font-semibold">{t.quantity}팩</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">주문별 상세 (팩킹) · 매장별</h3>
          <div className="space-y-6">
            {groupByStore(data.orders).map(([store, list]) => (
              <div key={store} className="break-inside-avoid">
                <div className="mb-2 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-800">
                  📦 {store} · {list.length}건
                </div>
                <div className="space-y-4">
                  {list.map((o) => (
                    <div key={o.id} className="break-inside-avoid rounded-2xl border border-gray-200 p-4">
                      <div className="border-b pb-2">
                        <div className="font-mono text-xs text-gray-500">{o.orderNumber}</div>
                        <div className="mt-0.5 text-base font-bold text-gray-900">
                          고객: {o.customerName} <span className="text-gray-400">/</span> {o.storeName}
                        </div>
                        <div className="mt-1 text-xs text-gray-600">
                          🏪 {o.storeAddress ?? '주소 미등록'}
                          {o.storePhone ? ` · ☎ ${o.storePhone}` : ''}
                        </div>
                      </div>
                      <div className="mt-2 divide-y divide-gray-50">
                        {o.items.map((it) => {
                          const displayName = formatLensDisplayName(
                            {
                              brand: it.lensBrand,
                              name: it.lensName,
                              replacementCycle: it.replacementCycle,
                              piecesPerBox: it.piecesPerBox,
                              lensType: it.lensType,
                            },
                            it,
                            { format: 'compact' },
                          );
                          return (
                            <div key={it.id} className="flex items-start justify-between gap-4 py-2">
                              <div className="flex-1 font-medium">
                                {displayName} <span className="text-gray-500">× {it.quantity}</span>
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-1.5">
                                {it.barcode
                                  ? Array.from({ length: it.quantity }).map((_, i) => (
                                      <Barcode key={i} value={it.barcode!} height={26} />
                                    ))
                                  : <span className="text-xs text-red-500">⚠ 바코드 미등록</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function PicklistPrintPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-400">불러오는 중…</div>}>
      <PicklistPrintInner />
    </Suspense>
  );
}
