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

interface CustomerProfile {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'other' | null;
  birthDate: string | null;
  phone: string;
  landlinePhone: string | null;
  postalCode: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  memberType: string;
  referrerCode: string | null;
  referredByCode: string | null;
  createdAt: string;
  email: string | null;
  username: string | null;
}

export default function CustomerMyPage() {
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);

  useEffect(() => {
    fetch('/api/orders')
      .then((r) => r.json())
      .then((d) => setOrders(d.orders ?? []))
      .catch(() => setOrders([]));
    fetch('/api/customer/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setProfile(d?.customer ?? null))
      .catch(() => setProfile(null));
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
        <p className="mt-1 text-sm text-gray-500">내 정보, 주문 현황, 시력정보를 한 곳에서 확인하세요.</p>
      </section>

      {/* 내 정보 */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">내 정보</h2>
        </div>
        {profile === null ? (
          <SkeletonCard />
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <div className="text-base font-semibold text-gray-900">{profile.name}</div>
                <div className="mt-0.5 text-xs text-gray-500">
                  {profile.username && <span className="font-mono">@{profile.username}</span>}
                  {profile.memberType && (
                    <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                      {profile.memberType === 'online' ? '온라인 가입' : '오프라인 가입'}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right text-[10px] text-gray-400">
                가입일: {new Date(profile.createdAt).toLocaleDateString('ko-KR')}
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
              <Info label="휴대전화" value={profile.phone || '—'} />
              <Info label="이메일" value={profile.email || '—'} />
              <Info
                label="생년월일"
                value={profile.birthDate ? new Date(profile.birthDate).toLocaleDateString('ko-KR') : '—'}
              />
              <Info
                label="성별"
                value={
                  profile.gender === 'male'
                    ? '남'
                    : profile.gender === 'female'
                    ? '여'
                    : profile.gender === 'other'
                    ? '기타'
                    : '—'
                }
              />
              <Info
                label="주소"
                value={
                  [profile.postalCode && `(${profile.postalCode})`, profile.addressLine1, profile.addressLine2]
                    .filter(Boolean)
                    .join(' ') || '—'
                }
                full
              />
              {profile.referrerCode && (
                <Info
                  label="내 추천코드 (공유용·자동발급)"
                  value={profile.referrerCode}
                  mono
                  full
                  hint="친구에게 이 코드를 공유하면 추천 혜택이 적용됩니다. 모든 회원에게 가입 시 자동 발급되며, 아래 '추천인'(가입 때 입력)과는 별개입니다."
                />
              )}
              {profile.referredByCode && (
                <Info label="추천인 (가입 시 입력)" value={profile.referredByCode} mono />
              )}
            </dl>
          </div>
        )}
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

function Info({
  label,
  value,
  full,
  mono,
  hint,
}: {
  label: string;
  value: string;
  full?: boolean;
  mono?: boolean;
  hint?: string;
}) {
  return (
    <div className={full ? 'sm:col-span-2' : undefined}>
      <dt className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
        {label}
      </dt>
      <dd
        className={`mt-0.5 text-sm text-gray-800 ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </dd>
      {hint && <p className="mt-0.5 text-[11px] leading-snug text-gray-500">{hint}</p>}
    </div>
  );
}
