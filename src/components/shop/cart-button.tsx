'use client';

import Link from 'next/link';
import { useCart } from '@/hooks/use-cart';
import { cartItemCount } from '@/lib/cart/store';

export function CartButton() {
  const items = useCart();
  const count = cartItemCount(items);

  return (
    <Link
      href="/cart"
      aria-label={`장바구니 (${count}개)`}
      className="relative grid h-10 w-10 place-items-center rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-[20px] place-items-center rounded-full bg-gray-900 px-1.5 text-[10px] font-bold text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
