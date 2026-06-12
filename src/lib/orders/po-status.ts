/**
 * 가맹점 발주(B2B store_orders) 상태 표시 — 단일 표준 소스 (전 화면 공통).
 * 상태 흐름(JINY): 발주접수(placed) → 주문접수(confirmed) → 배송중(shipped) → 입고완료(received) / 취소(cancelled).
 * 어느 화면도 라벨·색을 재정의하지 말고 여기서 import 할 것 (드리프트 방지).
 *
 * 참고: 고객 주문(orders) 상태는 src/types/order.ts(ORDER_STATUS_LABEL)+StatusBadge 가 표준.
 */
export type PoStatus = 'placed' | 'confirmed' | 'shipped' | 'received' | 'cancelled';

export const PO_STATUS: Record<PoStatus, { label: string; cls: string }> = {
  placed: { label: '발주접수', cls: 'bg-blue-100 text-blue-700' },
  confirmed: { label: '주문접수', cls: 'bg-amber-100 text-amber-700' },
  shipped: { label: '배송중', cls: 'bg-emerald-100 text-emerald-700' },
  received: { label: '입고완료', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: '취소', cls: 'bg-gray-200 text-gray-600' },
};

/** 라벨만 필요한 화면용. */
export const PO_STATUS_LABEL: Record<PoStatus, string> = {
  placed: PO_STATUS.placed.label,
  confirmed: PO_STATUS.confirmed.label,
  shipped: PO_STATUS.shipped.label,
  received: PO_STATUS.received.label,
  cancelled: PO_STATUS.cancelled.label,
};

/** 미지정 상태도 안전 처리하는 헬퍼. */
export function poStatusMeta(status: string): { label: string; cls: string } {
  return PO_STATUS[status as PoStatus] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
}
