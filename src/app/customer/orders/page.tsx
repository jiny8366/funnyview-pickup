'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { cn } from '@/lib/utils/cn';
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

type BucketFilter = OrderBucket | 'all';

const FILTERS: { key: BucketFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  ...ORDER_BUCKET_ORDER.map((b) => ({ key: b, label: ORDER_BUCKET_LABEL[b] })),
];

function CustomerOrdersInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = (searchParams.get('bucket') as BucketFilter | null) ?? 'all';
  const [filter, setFilter] = useState<BucketFilter>(
    FILTERS.some((f) => f.key === initial) ? initial : 'all',
  );
  const [orders, setOrders] = useState<OrderRow[] | null>(null);

  useEffect(() => {
    fetch('/api/orders')
      .then((r) => r.json())
      .then((data) => setOrders(data.orders ?? []))
      .catch(() => setOrders([]));
  }, []);

  const counts = useMemo(() => {
    const init: Record<BucketFilter, number> = {
      all: 0,
      received: 0,
      shipping: 0,
      pickup_waiting: 0,
      pickup_done: 0,
    };
    if (!orders) return init;
    init.all = orders.length;
    for (const o of orders) {
      const b = bucketOf(o.status);
      if (b) init[b] += 1;
    }
    return init;
  }, [orders]);

  const visible = useMemo(() => {
    if (!orders) return null;
    if (filter === 'all') return orders;
    const allow = new Set<OrderStatus>(ORDER_BUCKET_STATUSES[filter]);
    return orders.filter((o) => allow.has(o.status));
  }, [orders, filter]);

  function selectFilter(next: BucketFilter) {
    setFilter(next);
    const qs = next === 'all' ? '' : `?bucket=${next}`;
    router.replace(`/customer/orders${qs}`, { scroll: false });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold md:text-2xl">구매내역</h1>

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-1">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => selectFilter(f.key)}
              className={cn(
                'flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition',
                active ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100',
              )}
            >
              {f.label}
              <span className={cn('ml-1', active ? 'text-white/80' : 'text-gray-400')}>
                {orders === null ? '' : counts[f.key]}
              </span>
            </button>
          );
        })}
      </div>

      {visible === null ? (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-400">
          {filter === 'all' ? (
            <>
              주문 내역이 없습니다.{' '}
              <Link href="/customer/order" className="text-brand-600 hover:underline">
                지금 주문하기
              </Link>
            </>
          ) : (
            <>해당 단계의 주문이 없습니다.</>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((o) => (
            <li key={o.id}>
              <Link
                href={`/customer/orders/${o.id}`}
                className="block rounded-2xl border border-gray-200 bg-white p-4 transition active:scale-[0.99] hover:border-brand-300"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-500">{o.orderNumber}</div>
                    <div className="mt-0.5 font-semibold">{o.storeName}</div>
                  </div>
                  <StatusBadge status={o.status} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500">
                  <div>주문일시: {formatDateTime(o.createdAt)}</div>
                  <div className="text-right">{formatKRW(o.total)}</div>
                  {o.shippedAt && <div>출고: {formatDateTime(o.shippedAt)}</div>}
                  {o.readyAt && <div>도착: {formatDateTime(o.readyAt)}</div>}
                  {o.completedAt && (
                    <div className="text-right">완료: {formatDateTime(o.completedAt)}</div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function CustomerOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      }
    >
      <CustomerOrdersInner />
    </Suspense>
  );
}
