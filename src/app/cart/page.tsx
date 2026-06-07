'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SiteHeader } from '@/components/layout/site-header';
import { StorePicker, type PickerStore } from '@/components/shop/store-picker';
import { useCart } from '@/hooks/use-cart';
import {
  cartItemCount,
  cartTotalPrice,
  clearCart,
  removeItem,
  updateQuantity,
  type CartItem,
} from '@/lib/cart/store';
import { getPreferredStore, setPreferredStore } from '@/lib/cart/pickup-store';

export default function CartPage() {
  const items = useCart();
  const router = useRouter();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginRequired, setLoginRequired] = useState(false);

  // 매장찾기에서 넘어온 선호 매장을 기본 선택
  useEffect(() => {
    const pref = getPreferredStore();
    if (pref) {
      setStoreId(pref.id);
      setStoreName(pref.name);
    }
  }, []);

  function handleSelectStore(id: string, store: PickerStore) {
    setStoreId(id);
    setStoreName(store.name);
    setPreferredStore({ id, name: store.name, address: store.address });
  }

  const totalPrice = cartTotalPrice(items);
  const totalCount = cartItemCount(items);

  async function handleSubmit() {
    if (items.length === 0 || !storeId) return;
    setSubmitting(true);
    setError(null);
    setLoginRequired(false);

    const lines = items.map((it) => ({
      variantId: it.variantId,
      eyeSide: it.eyeSide,
      quantity: it.quantity,
    }));

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        pickupStoreId: storeId,
        customerNote: note || undefined,
        lines,
        payOnline: false,
      }),
    });

    setSubmitting(false);
    if (res.status === 401) {
      setLoginRequired(true);
      return;
    }
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.message ?? '주문 생성 실패');
      return;
    }
    const data = await res.json();
    clearCart();
    router.replace(`/customer/orders/${data.orderId}`);
  }

  return (
    <div className="min-h-screen bg-white pb-40 md:pb-0">
      {/* Header */}
      <SiteHeader />

      <section className="border-b border-gray-100 px-4 pb-6 pt-8 md:px-8 md:pb-8 md:pt-12">
        <div className="mx-auto max-w-screen-xl">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Cart</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900 md:text-5xl">장바구니</h1>
          {totalCount > 0 && (
            <p className="mt-2 text-sm text-gray-500">총 {totalCount}개 항목</p>
          )}
        </div>
      </section>

      <main className="mx-auto max-w-screen-xl px-4 py-6 md:px-8 md:py-10">
        {items.length === 0 ? (
          <EmptyCart />
        ) : (
          <div className="grid gap-8 md:grid-cols-3 md:gap-10">
            {/* Items */}
            <div className="md:col-span-2 space-y-3">
              {items.map((it) => (
                <CartRow key={it.key} item={it} />
              ))}
            </div>

            {/* Summary */}
            <aside className="md:sticky md:top-20 md:self-start space-y-4">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                <h2 className="text-sm font-bold text-gray-900">주문 요약</h2>
                <div className="mt-4 space-y-2 text-sm">
                  <Row label={`상품 (${totalCount}개)`} value={totalPrice === 0 ? '가격문의' : `${totalPrice.toLocaleString()}원`} />
                </div>
                <div className="mt-3 flex items-baseline justify-between border-t border-gray-200 pt-3">
                  <span className="text-sm text-gray-600">총 결제 예정</span>
                  <span className="text-xl font-bold text-gray-900">
                    {totalPrice === 0 ? '가격문의' : `${totalPrice.toLocaleString()}원`}
                  </span>
                </div>
              </div>

              {/* Store select — 위치 기반 추천 + 검색 */}
              <div className="rounded-2xl border border-gray-100 p-5">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-sm font-bold text-gray-900">픽업 매장</h2>
                  {storeName && (
                    <span className="truncate text-xs font-medium text-emerald-700">
                      ✓ {storeName}
                    </span>
                  )}
                </div>
                <div className="mt-3">
                  <StorePicker value={storeId} onSelect={handleSelectStore} />
                </div>
              </div>

              {/* Payment — 매장 결제 전용 */}
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                <h2 className="text-sm font-bold text-gray-900">결제 방식</h2>
                <p className="mt-2 text-sm text-gray-700">픽업 시 <span className="font-semibold">매장에서 결제</span>합니다.</p>
              </div>

              {/* Note */}
              <div className="rounded-2xl border border-gray-100 p-5">
                <h2 className="text-sm font-bold text-gray-900">요청사항</h2>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="시력 / 도수 / 픽업 요청 (선택)"
                  rows={3}
                  className="mt-3 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {error}
                </div>
              )}

              {loginRequired && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  주문하려면 로그인이 필요합니다.{' '}
                  <Link href={`/login?next=${encodeURIComponent('/cart')}`} className="font-semibold underline">
                    로그인하기
                  </Link>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={!storeId || submitting || items.length === 0}
                className="hidden w-full rounded-2xl bg-gray-900 py-4 text-sm font-bold text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 md:block"
              >
                {submitting ? '주문 처리중...' : '예약 주문하기'}
              </button>
            </aside>
          </div>
        )}
      </main>

      {/* Mobile sticky bottom */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white p-3 shadow-lg md:hidden">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs text-gray-500">총 {totalCount}개</span>
            <span className="text-lg font-bold text-gray-900">
              {totalPrice === 0 ? '가격문의' : `${totalPrice.toLocaleString()}원`}
            </span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={!storeId || submitting}
            className="w-full rounded-xl bg-gray-900 py-3.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {!storeId ? '픽업 매장을 선택하세요' : submitting ? '주문 처리중...' : '예약 주문하기'}
          </button>
        </div>
      )}
    </div>
  );
}

function CartRow({ item }: { item: CartItem }) {
  const imageSrc = item.imageUrl ?? `/api/lens-image/${item.productCode}`;
  const cycleLabel: Record<string, string> = {
    '1day': '원데이', '2week': '2주', '1month': '1개월', '3month': '3개월', '6month': '6개월', '1year': '1년',
  };
  const cycle = cycleLabel[item.cycle] ?? item.cycle;

  const parts = [`SPH ${item.sphere}`];
  if (item.cylinder) parts.push(`CYL ${item.cylinder}`);
  if (item.axis !== null) parts.push(`AXIS ${item.axis}`);
  if (item.addPower) parts.push(`ADD ${item.addPower}`);
  const variantLabel = parts.join(' · ');

  return (
    <div className="flex gap-3 rounded-2xl border border-gray-100 p-3 md:gap-4 md:p-4">
      <Link href={`/products/${item.productCode}`} className="shrink-0">
        <div className="h-20 w-20 overflow-hidden rounded-xl bg-gray-100 md:h-24 md:w-24">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageSrc} alt={item.name} className="h-full w-full object-cover" />
        </div>
      </Link>
      <div className="flex flex-1 flex-col justify-between min-w-0">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">{item.brand}</p>
          <Link href={`/products/${item.productCode}`} className="block">
            <p className="truncate text-sm font-semibold text-gray-900">{item.name}</p>
          </Link>
          {item.colorName && (
            <p className="mt-0.5 text-xs text-gray-500">{item.colorName}</p>
          )}
          <p className="mt-1 text-[11px] text-gray-500">
            {item.eyeSide === 'left' ? '왼쪽' : '오른쪽'} · {variantLabel}
          </p>
          <p className="text-[11px] text-gray-400">{cycle} · {item.piecesPerBox}매입</p>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="inline-flex items-center rounded-lg border border-gray-200">
            <button
              onClick={() => updateQuantity(item.key, item.quantity - 1)}
              className="grid h-8 w-8 place-items-center text-gray-600 hover:bg-gray-50"
              aria-label="수량 감소"
            >
              −
            </button>
            <span className="w-8 text-center text-xs font-medium">{item.quantity}</span>
            <button
              onClick={() => updateQuantity(item.key, item.quantity + 1)}
              className="grid h-8 w-8 place-items-center text-gray-600 hover:bg-gray-50"
              aria-label="수량 증가"
            >
              +
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-gray-900">
              {item.price === 0 ? '가격문의' : `${(item.price * item.quantity).toLocaleString()}원`}
            </span>
            <button
              onClick={() => removeItem(item.key)}
              aria-label="삭제"
              className="text-gray-400 hover:text-red-500"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="py-24 text-center">
      <p className="text-5xl">🛒</p>
      <p className="mt-4 text-lg font-semibold text-gray-700">장바구니가 비어있습니다</p>
      <p className="mt-1 text-sm text-gray-400">마음에 드는 렌즈를 담아보세요</p>
      <Link
        href="/products"
        className="mt-6 inline-block rounded-full bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-gray-700"
      >
        쇼핑 시작하기
      </Link>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900">{value}</span>
    </div>
  );
}
