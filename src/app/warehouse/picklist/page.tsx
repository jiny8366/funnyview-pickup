'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { formatLensDisplayName } from '@/lib/lens/format';
import { formatDateTime } from '@/lib/utils/format';
import { Barcode } from '@/components/warehouse/barcode';

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string;
  customerPhone: string;
  storeId: string;
  storeName: string;
  itemCount: number;
  acceptedAt: string | null;
  pickingAt: string | null;
}

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
  barcode: string | null; // 제품 바코드(GTIN/UDI-DI)
  // lens 마스터 보강
  replacementCycle: string;
  piecesPerBox: number;
  lensType: string;
}

interface SkuTotal {
  sku: string;
  lensName: string;
  lensBrand: string;
  replacementCycle: string;
  piecesPerBox: number;
  lensType: string;
  quantity: number;
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
  skuTotals: SkuTotal[];
}

// 픽업매장별 그룹핑 (가나다순) — 대량 분류/발송 효율
function groupByStore<T extends { storeName: string }>(list: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const o of list) {
    const arr = map.get(o.storeName) ?? [];
    arr.push(o);
    map.set(o.storeName, arr);
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'ko-KR'));
}

export default function WarehousePicklistPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [picklist, setPicklist] = useState<PicklistData | null>(null);
  const [pickedSkus, setPickedSkus] = useState<Set<string>>(new Set()); // 피킹 완료 체크
  const [shippedMsg, setShippedMsg] = useState<string | null>(null); // 검수→배송 후 복귀 확인
  const [packMsg, setPackMsg] = useState<string | null>(null); // 팩킹확정 결과 안내
  const [packing, setPacking] = useState(false);
  const allSelected = orders.length > 0 && selected.size === orders.length;
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(orders.map((o) => o.id)));
  }
  // 매장 단위 일괄선택 — 같은 가맹점 주문을 한 번에 묶어 픽리스트/발송 처리(한 가맹점 = 한 박스)
  function toggleStore(list: OrderRow[]) {
    const groupIds = list.map((o) => o.id);
    const allIn = groupIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const n = new Set(prev);
      groupIds.forEach((id) => (allIn ? n.delete(id) : n.add(id)));
      return n;
    });
  }
  function togglePicked(sku: string) {
    setPickedSkus((p) => {
      const n = new Set(p);
      n.has(sku) ? n.delete(sku) : n.add(sku);
      return n;
    });
  }

  // 주문처리 대상(신규 결제완료 포함)을 픽리스트에 바로 반영 — 별도 '주문처리' 단계 생략 (JINY 확정)
  const loadOrders = () =>
    fetch('/api/warehouse/orders?status=paid,accepted,picking')
      .then((r) => r.json())
      .then((j) => setOrders(j.orders ?? []));

  useEffect(() => {
    loadOrders();
  }, []);

  // 검수→배송 후 picklist 로 복귀 시 출고 확인 토스트 (URL ?shipped=주문번호)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const s = new URLSearchParams(window.location.search).get('shipped');
    if (!s) return;
    setShippedMsg(s);
    window.history.replaceState(null, '', '/warehouse/picklist');
    const t = setTimeout(() => setShippedMsg(null), 4000);
    return () => clearTimeout(t);
  }, []);

  async function generate(thenPrint = false) {
    if (selected.size === 0) return;
    const res = await fetch('/api/warehouse/picklist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderIds: Array.from(selected) }),
    });
    if (res.ok) {
      setPicklist(await res.json());
      if (thenPrint) setTimeout(() => window.print(), 500); // 렌더(바코드) 후 인쇄
    }
  }

  function printPage() {
    window.print();
  }

  // 팩킹확정 — 체크한 항목을 다음 단계(배송준비, picking)로 일괄 전이.
  // markPicking 이 고객·픽업가맹점에 '주문접수' 알림을 자동 발송한다 (보드 #11).
  const pendingSelected = orders.filter((o) => selected.has(o.id) && o.status !== 'picking');
  async function confirmPacking() {
    if (pendingSelected.length === 0 || packing) return;
    setPacking(true);
    try {
      let ok = 0;
      for (const o of pendingSelected) {
        // paid/accepted → picking 직행 허용(ALLOWED_FROM) — 전이 1회로 충분
        const r = await fetch(`/api/warehouse/orders/${o.id}/transition`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'pick' }),
        });
        if (r.ok) ok++;
      }
      // 팩킹확정 후 다음 팩킹(검수) 단계로 바로 이동 (JINY 확정):
      //  - 선택이 한 가맹점이면 그 가맹점 묶음 팩킹으로, 단일 주문이면 단건 검수로
      //  - 여러 가맹점이 섞였으면 목록에 남아 가맹점별 팩킹 버튼으로 진행 안내
      const sel = orders.filter((x) => selected.has(x.id));
      const storeIds = [...new Set(sel.map((x) => x.storeId))];
      if (ok > 0 && storeIds.length === 1) {
        router.push(sel.length === 1 ? `/warehouse/packing/${sel[0].id}` : `/warehouse/packing/store/${storeIds[0]}`);
        return;
      }
      setPackMsg(
        ok > 0
          ? `📦 ${ok}건 팩킹확정(주문접수 안내 발송) — 가맹점이 여러 곳입니다. 아래 🏪 가맹점별 [팩킹·확정] 버튼으로 이어가세요.`
          : '팩킹확정에 실패했습니다. 다시 시도해 주세요.',
      );
      setTimeout(() => setPackMsg(null), 8000);
      await loadOrders();
    } finally {
      setPacking(false);
    }
  }

  // 출고(배송)는 이제 패킹 검수 화면(/warehouse/packing/[id])에서 스캔 검수 후 진행한다.

  // 거래명세서/송장 출력은 픽리스트가 아닌 다음 단계(팩킹 검수 확정 후)에서 — 상단은 미리보기·인쇄만 (JINY 확정)

  return (
    <div className="space-y-6">
      {/* 배송준비중 처리 허브 — 햄버거 없이 화면 안에서 전체 순서 진행 */}
      <div className="print:hidden">
        <Link href="/warehouse/orders" className="text-sm text-gray-500 hover:text-gray-700">
          ← 주문 처리
        </Link>
      </div>
      {packMsg && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-800 print:hidden">
          <span>{packMsg}</span>
          <button type="button" onClick={() => setPackMsg(null)} className="text-blue-600 hover:text-blue-800">✕</button>
        </div>
      )}
      {shippedMsg && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 print:hidden">
          <span>✅ <b className="font-mono">{shippedMsg}</b> 출고(배송 중) 완료 — 다음 주문을 이어서 처리하세요.</span>
          <button type="button" onClick={() => setShippedMsg(null)} className="text-emerald-600 hover:text-emerald-800">✕</button>
        </div>
      )}
      <header className="flex flex-col gap-3 print:hidden md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">배송준비중 — 픽리스트</h1>
          <p className="mt-1 text-xs text-gray-500">
            픽리스트/거래명세서/송장 출력 후 <b>검수→배송</b>. 단계: 주문접수 → <b>픽리스트 출력(배송준비)</b> → 검수 → 배송중.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!picklist ? (
            <>
              {/* 상단 = 픽리스트 미리보기·인쇄 + 팩킹확정만 (JINY 확정 — 명세서/송장은 검수 확정 후) */}
              <Button onClick={() => generate(false)} variant="secondary" disabled={selected.size === 0}>
                👁 미리보기 ({selected.size})
              </Button>
              <Button onClick={() => generate(true)} disabled={selected.size === 0} className="bg-emerald-600 hover:bg-emerald-700">
                🖨 인쇄 ({selected.size})
              </Button>
              <Button onClick={confirmPacking} disabled={pendingSelected.length === 0 || packing} className="bg-blue-600 hover:bg-blue-700">
                {packing ? '확정 중…' : `📦 팩킹확정 → 다음단계 (${pendingSelected.length})`}
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setPicklist(null)}>
                ← 목록으로
              </Button>
              <Button onClick={printPage} className="bg-emerald-600 hover:bg-emerald-700">
                🖨 인쇄 / PDF 저장
              </Button>
            </>
          )}
        </div>
      </header>

      {!picklist ? (
        <section className="space-y-3 print:hidden">
          <p className="text-sm text-gray-500">
            주문을 선택해 픽리스트를 생성하세요. 접수/패킹 중 주문이 대상입니다.
          </p>
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left whitespace-nowrap">
                    <label className="inline-flex items-center gap-1.5">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="전체선택" />
                      피킹
                    </label>
                  </th>
                  <th className="px-3 py-2 text-left">주문번호</th>
                  <th className="px-3 py-2 text-left">고객</th>
                  <th className="px-3 py-2 text-left">픽업가맹점</th>
                  <th className="px-3 py-2 text-right">아이템</th>
                  <th className="px-3 py-2 text-right">팩킹(배송)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {groupByStore(orders).map(([store, list]) => {
                  const groupAll = list.every((o) => selected.has(o.id));
                  const groupItems = list.reduce((s, o) => s + o.itemCount, 0);
                  return (
                    <Fragment key={store}>
                      {/* 가맹점 그룹 헤더 — 동일 가맹점 묶음 + 매장 단위 일괄선택 + 매장 단위 팩킹 진입 */}
                      <tr className="bg-gray-100">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={groupAll}
                            onChange={() => toggleStore(list)}
                            aria-label={`${store} 전체선택`}
                          />
                        </td>
                        <td colSpan={3} className="px-3 py-2 text-sm font-semibold text-gray-800">
                          🏪 {store} · {list.length}건 · {groupItems}아이템
                        </td>
                        <td colSpan={2} className="px-3 py-2 text-right">
                          {/* 한 가맹점의 여러 전표를 한 박스로 묶어 스캔 검수 → 확정 → 거래명세서 동봉 → 배송 */}
                          <Link
                            href={`/warehouse/packing/store/${list[0].storeId}`}
                            className="inline-block rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                          >
                            📦 이 가맹점 팩킹·확정 →
                          </Link>
                        </td>
                      </tr>
                      {list.map((o) => (
                        <tr key={o.id}>
                          <td className="px-3 py-2 pl-6">
                            <input
                              type="checkbox"
                              checked={selected.has(o.id)}
                              onChange={() => {
                                const n = new Set(selected);
                                n.has(o.id) ? n.delete(o.id) : n.add(o.id);
                                setSelected(n);
                              }}
                            />
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {o.orderNumber}
                            <span className={`ml-1.5 rounded px-1.5 py-0.5 font-sans text-[10px] font-semibold ${
                              o.status === 'paid' ? 'bg-amber-50 text-amber-700' : o.status === 'accepted' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
                            }`}>
                              {o.status === 'paid' ? '신규' : o.status === 'accepted' ? '접수' : '배송준비'}
                            </span>
                          </td>
                          <td className="px-3 py-2">{o.customerName}</td>
                          <td className="px-3 py-2 text-gray-400">{o.storeName}</td>
                          <td className="px-3 py-2 text-right">{o.itemCount}</td>
                          <td className="px-3 py-2 text-right">
                            {/* 단건 검수(부족분 급매입 등 개별 처리). 일반 배송은 가맹점 단위 팩킹 권장 */}
                            <Link
                              href={`/warehouse/packing/${o.id}`}
                              className="inline-block rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
                            >
                              단건 검수
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                      대상 주문 없음
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="doc-light space-y-6 rounded-2xl bg-white p-4">
          <header className="border-b pb-3">
            <h2 className="text-xl font-bold">픽리스트</h2>
            <p className="text-xs text-gray-500">
              생성: {formatDateTime(picklist.generatedAt)} · 총 {picklist.orders.length}개 주문
            </p>
          </header>

          <section>
            <h3 className="mb-2 text-sm font-semibold">
              SKU 합산 (피킹) · 완료 {pickedSkus.size}/{picklist.skuTotals.length}
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
                {picklist.skuTotals.map((t) => (
                  <tr key={t.sku} className={pickedSkus.has(t.sku) ? 'bg-emerald-50 text-gray-400 line-through' : ''}>
                    <td className="px-3 py-2 text-center print:hidden">
                      <input type="checkbox" checked={pickedSkus.has(t.sku)} onChange={() => togglePicked(t.sku)} aria-label="피킹 완료" />
                    </td>
                    <td className="px-3 py-2">
                      <div>
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
                      </div>
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
              {groupByStore(picklist.orders).map(([store, list]) => (
                <div key={store} className="break-inside-avoid">
                  <div className="mb-2 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-800">
                    📦 {store} · {list.length}건
                  </div>
                  <div className="space-y-4">
                    {list.map((o) => (
                      <div key={o.id} className="break-inside-avoid rounded-2xl border border-gray-200 p-4">
                  {/* 1) 전표번호 2) 고객명/가맹점명 3) 가맹점 정보 */}
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
                  {/* 4) 제품 정보 — 바코드는 우측 세로 배열(스캔 방해 방지) */}
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
        </section>
      )}
    </div>
  );
}
