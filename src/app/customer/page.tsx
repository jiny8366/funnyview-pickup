'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { StatusBadge } from '@/components/ui/badge';
import { SkeletonCard } from '@/components/ui/skeleton';
import {
  ORDER_BUCKET_LABEL,
  ORDER_BUCKET_ORDER,
  ORDER_BUCKET_STATUSES,
  bucketOf,
  type OrderBucket,
} from '@/lib/orders/buckets';
import { formatDateTime, formatKRW } from '@/lib/utils/format';
import type { OrderStatus } from '@/types/order';

interface OrderRow {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  total: number;
  createdAt: string;
  shippedAt: string | null;
  readyAt: string | null;
  completedAt: string | null;
  storeName: string;
  storePhone: string;
  itemCount: number;
}

export default function CustomerMyPage() {
  const [orders, setOrders] = useState<OrderRow[] | null>(null);

  useEffect(() => {
    fetch('/api/orders')
      .then((r) => r.json())
      .then((d) => setOrders(d.orders ?? []))
      .catch(() => setOrders([]));
  }, []);

  const counts = useMemo(() => {
    const init: Record<OrderBucket, number> = {
      received: 0,
      shipping: 0,
      pickup_waiting: 0,
      pickup_done: 0,
    };
    if (!orders) return init;
    for (const o of orders) {
      const b = bucketOf(o.status);
      if (b) init[b] += 1;
    }
    return init;
  }, [orders]);

  const recent = useMemo(() => (orders ? orders.slice(0, 5) : []), [orders]);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold">마이페이지</h1>
        <p className="mt-1 text-sm text-gray-500">주문 현황과 시력정보를 한 곳에서 확인하세요.</p>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">주문 현황</h2>
          <Link href="/customer/orders" className="text-xs text-brand-600 hover:underline">
            전체보기 →
          </Link>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {ORDER_BUCKET_ORDER.map((b) => {
            const statuses = ORDER_BUCKET_STATUSES[b];
            const href = `/customer/orders?bucket=${b}`;
            return (
              <Link
                key={b}
                href={href}
                className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-3 text-center transition active:scale-[0.99] hover:border-brand-300"
              >
                <div className="text-2xl font-bold text-brand-600">
                  {orders === null ? '–' : counts[b]}
                </div>
                <div className="mt-1 text-xs text-gray-600">{ORDER_BUCKET_LABEL[b]}</div>
                <div className="mt-0.5 text-[10px] text-gray-400">{statuses.length}단계</div>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">바로가기</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link
            href="/customer/order"
            className="rounded-2xl border border-gray-200 bg-white p-4 hover:border-brand-500"
          >
            <div className="text-2xl" aria-hidden>
              🛒
            </div>
            <div className="mt-2 font-semibold">주문하기</div>
            <div className="mt-0.5 text-xs text-gray-500">렌즈 선택 → 가맹점 → 결제</div>
          </Link>
          <Link
            href="/customer/orders"
            className="rounded-2xl border border-gray-200 bg-white p-4 hover:border-brand-500"
          >
            <div className="text-2xl" aria-hidden>
              📦
            </div>
            <div className="mt-2 font-semibold">구매내역</div>
            <div className="mt-0.5 text-xs text-gray-500">접수 · 배송 · 픽업 · 완료</div>
          </Link>
          <Link
            href="/customer/prescriptions"
            className="rounded-2xl border border-gray-200 bg-white p-4 hover:border-brand-500"
          >
            <div className="text-2xl" aria-hidden>
              👁️
            </div>
            <div className="mt-2 font-semibold">도수정보</div>
            <div className="mt-0.5 text-xs text-gray-500">안경 · 콘택트 도수 기록</div>
          </Link>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">최근 주문</h2>
          <Link href="/customer/orders" className="text-xs text-brand-600 hover:underline">
            전체 구매내역 →
          </Link>
        </div>
        {orders === null ? (
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : recent.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-400">
            주문 내역이 없습니다.{' '}
            <Link href="/customer/order" className="text-brand-600 hover:underline">
              지금 주문하기
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {recent.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/customer/orders/${o.id}`}
                  className="block rounded-2xl border border-gray-200 bg-white p-4 transition active:scale-[0.99] hover:border-brand-300"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="text-xs text-gray-500">{o.orderNumber}</div>
                      <div className="mt-0.5 truncate font-semibold">{o.storeName}</div>
                    </div>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                    <span>{formatDateTime(o.createdAt)}</span>
                    <span className="font-medium text-gray-700">{formatKRW(o.total)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
