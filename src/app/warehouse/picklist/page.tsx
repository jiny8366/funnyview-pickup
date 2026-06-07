'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  formatLensDisplayName,
  formatLensSpec,
  formatPackQuantity,
} from '@/lib/lens/format';
import { formatDateTime } from '@/lib/utils/format';

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string;
  customerPhone: string;
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

export default function WarehousePicklistPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [picklist, setPicklist] = useState<PicklistData | null>(null);

  useEffect(() => {
    fetch('/api/warehouse/orders?status=accepted,picking')
      .then((r) => r.json())
      .then((j) => setOrders(j.orders ?? []));
  }, []);

  async function generate() {
    if (selected.size === 0) return;
    const res = await fetch('/api/warehouse/picklist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderIds: Array.from(selected) }),
    });
    if (res.ok) setPicklist(await res.json());
  }

  function printPage() {
    window.print();
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold">픽리스트</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={generate} disabled={selected.size === 0}>
            픽리스트 생성 ({selected.size})
          </Button>
          {picklist && (
            <>
              <Button variant="secondary" onClick={() => setPicklist(null)}>
                ← 목록으로
              </Button>
              <Button onClick={printPage} className="bg-emerald-600 hover:bg-emerald-700">
                🖨 인쇄
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
                  <th className="px-3 py-2 text-left w-8"></th>
                  <th className="px-3 py-2 text-left">주문번호</th>
                  <th className="px-3 py-2 text-left">고객</th>
                  <th className="px-3 py-2 text-left">픽업가맹점</th>
                  <th className="px-3 py-2 text-right">아이템</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-3 py-2">
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
                    <td className="px-3 py-2 font-mono text-xs">{o.orderNumber}</td>
                    <td className="px-3 py-2">{o.customerName}</td>
                    <td className="px-3 py-2">{o.storeName}</td>
                    <td className="px-3 py-2 text-right">{o.itemCount}</td>
                  </tr>
                ))}
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
      ) : (
        <section className="space-y-6">
          <header className="border-b pb-3">
            <h2 className="text-xl font-bold">픽리스트</h2>
            <p className="text-xs text-gray-500">
              생성: {formatDateTime(picklist.generatedAt)} · 총 {picklist.orders.length}개 주문
            </p>
          </header>

          <section>
            <h3 className="mb-2 text-sm font-semibold">SKU 합산 (피킹)</h3>
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">SKU</th>
                  <th className="px-3 py-2 text-left">제품 (브랜드 / 제품명 / 주기 / 팩수)</th>
                  <th className="px-3 py-2 text-right">총 수량</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {picklist.skuTotals.map((t) => (
                  <tr key={t.sku}>
                    <td className="px-3 py-2 font-mono text-xs">{t.sku}</td>
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
                          {
                            sku: t.sku,
                            sphere: '0',
                            cylinder: null,
                            axis: null,
                            addPower: null,
                          },
                          { format: 'full' },
                        ).replace(/ \/ SPH \+0\.00$/, '')}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="font-semibold">{t.quantity}팩</div>
                      <div className="text-xs text-gray-500">
                        ({(t.quantity * t.piecesPerBox).toLocaleString()}매)
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold">주문별 상세 (팩킹)</h3>
            <div className="space-y-4">
              {picklist.orders.map((o) => (
                <div key={o.id} className="break-inside-avoid rounded-2xl border border-gray-200 p-4">
                  <div className="border-b pb-2">
                    <div className="font-mono text-xs text-gray-500">{o.orderNumber}</div>
                    <div className="text-base font-bold text-gray-900">👤 {o.customerName} · {o.customerPhone}</div>
                    <div className="mt-0.5 text-xs text-gray-600">
                      픽업매장: <span className="font-medium text-gray-800">{o.storeName}</span>
                      {o.storeAddress ? ` · ${o.storeAddress}` : ''}
                    </div>
                  </div>
                  <ul className="mt-2 divide-y divide-gray-100 text-sm">
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
                        { format: 'full' },
                      );
                      const eyeLabel =
                        it.eyeSide === 'left' ? 'OS (좌)' : it.eyeSide === 'right' ? 'OD (우)' : '양안';
                      return (
                        <li key={it.id} className="py-2">
                          <div className="font-medium">{displayName}</div>
                          <div className="mt-0.5 text-xs text-gray-600">
                            {eyeLabel} · {formatPackQuantity(it.quantity, it.piecesPerBox)}
                          </div>
                          <div className="text-[11px] font-mono text-gray-400">SKU {it.skuSnapshot}</div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </section>
      )}
    </div>
  );
}
