'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

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
            이 단계는 <b>픽리스트 미리보기·인쇄</b>까지만. 거래명세서·송장은 다음 단계(팩킹 검수 확정 후)에서 출력합니다.
            단계: <b>픽리스트(미리보기·인쇄) → 팩킹확정 → 검수 → 명세서·송장 → 배송</b>

          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* 픽리스트: 미리보기 / 인쇄(자식창) / 팩킹확정 — 이 3개만 (JINY 확정) */}
          <Button
            variant="secondary"
            disabled={selected.size === 0}
            onClick={() => window.open(`/warehouse/picklist/print?ids=${Array.from(selected).join(',')}`, 'fvdocprint', 'width=920,height=760')}
          >
            👁 미리보기 ({selected.size})
          </Button>
          <Button
            disabled={selected.size === 0}
            onClick={() => window.open(`/warehouse/picklist/print?ids=${Array.from(selected).join(',')}&autoprint=1`, 'fvdocprint', 'width=920,height=760')}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            🖨 인쇄 ({selected.size})
          </Button>
          <Button onClick={confirmPacking} disabled={pendingSelected.length === 0 || packing} className="bg-blue-600 hover:bg-blue-700">
            {packing ? '확정 중…' : `📦 팩킹확정 → 다음단계 (${pendingSelected.length})`}
          </Button>
        </div>
      </header>

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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {groupByStore(orders).map(([store, list]) => {
                  const groupAll = list.every((o) => selected.has(o.id));
                  const groupItems = list.reduce((s, o) => s + o.itemCount, 0);
                  return (
                    <Fragment key={store}>
                      {/* 가맹점 그룹 헤더 — 동일 가맹점 묶음 + 매장 단위 일괄선택.
                          진행은 체크 → 상단 '팩킹확정' 버튼 하나로 통일 (JINY 확정 — 행별 버튼 없음) */}
                      <tr className="bg-gray-100">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={groupAll}
                            onChange={() => toggleStore(list)}
                            aria-label={`${store} 전체선택`}
                          />
                        </td>
                        <td colSpan={4} className="px-3 py-2 text-sm font-semibold text-gray-800">
                          🏪 {store} · {list.length}건 · {groupItems}아이템
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
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-gray-400">
                      대상 주문 없음
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
    </div>
  );
}
