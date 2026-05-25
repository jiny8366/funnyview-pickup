'use client';

import { useSyncExternalStore } from 'react';
import { getCartSnapshot, getCartServerSnapshot, subscribe } from '@/lib/cart/store';
import type { CartItem } from '@/lib/cart/store';

export function useCart(): CartItem[] {
  return useSyncExternalStore(subscribe, getCartSnapshot, getCartServerSnapshot);
}
