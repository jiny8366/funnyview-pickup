/**
 * 선택한 픽업 매장을 localStorage 에 보관 — 매장찾기(/stores) → 장바구니(/cart) 인계용.
 * 고객이 매장찾기에서 "이 매장으로 주문" 을 누르면 저장되고, 장바구니가 기본 선택으로 읽는다.
 */

export interface PreferredStore {
  id: string;
  name: string;
  address: string;
}

const KEY = 'fv_pickup_store_v1';

function isBrowser() {
  return typeof window !== 'undefined';
}

export function getPreferredStore(): PreferredStore | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return obj && typeof obj.id === 'string' ? (obj as PreferredStore) : null;
  } catch {
    return null;
  }
}

export function setPreferredStore(store: PreferredStore): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

export function clearPreferredStore(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
