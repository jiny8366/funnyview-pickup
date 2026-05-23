/**
 * 로컬 스토리지 기반 장바구니 (server-side 카트 없이 클라이언트 단독 운용).
 * 동일 SKU + eye 조합은 quantity 가산. 다른 eye 는 별도 라인.
 */

export interface CartItem {
  /** {variantId}|{eyeSide} 조합 — 카트 내 unique key */
  key: string;
  variantId: string;
  productCode: string;
  brand: string;
  name: string;
  colorName: string | null;
  imageUrl: string | null;
  cycle: string; // replacementCycle
  piecesPerBox: number;
  sphere: string;
  cylinder: string | null;
  axis: number | null;
  addPower: string | null;
  price: number;
  quantity: number;
  eyeSide: 'left' | 'right';
  addedAt: number;
}

const KEY = 'fv_cart_v1';
const EVENT = 'fv_cart_change';

function isBrowser() {
  return typeof window !== 'undefined';
}

export function readCart(): CartItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as CartItem[]) : [];
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(EVENT));
}

export function buildKey(variantId: string, eyeSide: 'left' | 'right'): string {
  return `${variantId}|${eyeSide}`;
}

export function addItem(item: Omit<CartItem, 'key' | 'addedAt'>): CartItem[] {
  const items = readCart();
  const key = buildKey(item.variantId, item.eyeSide);
  const existing = items.find((i) => i.key === key);
  if (existing) {
    existing.quantity += item.quantity;
  } else {
    items.push({ ...item, key, addedAt: Date.now() });
  }
  writeCart(items);
  return items;
}

export function updateQuantity(key: string, quantity: number): CartItem[] {
  let items = readCart();
  if (quantity <= 0) {
    items = items.filter((i) => i.key !== key);
  } else {
    items = items.map((i) => (i.key === key ? { ...i, quantity } : i));
  }
  writeCart(items);
  return items;
}

export function removeItem(key: string): CartItem[] {
  const items = readCart().filter((i) => i.key !== key);
  writeCart(items);
  return items;
}

export function clearCart(): CartItem[] {
  writeCart([]);
  return [];
}

export function cartTotalPrice(items: CartItem[]): number {
  return items.reduce((s, i) => s + i.price * i.quantity, 0);
}

export function cartItemCount(items: CartItem[]): number {
  return items.reduce((s, i) => s + i.quantity, 0);
}

/** React hook 없이 vanilla 구독 — useSyncExternalStore 와 호환 */
export function subscribe(cb: () => void): () => void {
  if (!isBrowser()) return () => {};
  const handler = () => cb();
  window.addEventListener(EVENT, handler);
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) cb();
  });
  return () => {
    window.removeEventListener(EVENT, handler);
  };
}

export const CART_STORAGE_KEY = KEY;
