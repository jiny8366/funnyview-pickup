import type { OrderStatus } from '@/types/order';

export type OrderBucket = 'received' | 'shipping' | 'pickup_waiting' | 'pickup_done';

export const ORDER_BUCKET_LABEL: Record<OrderBucket, string> = {
  received: '주문접수',
  shipping: '배송중',
  pickup_waiting: '픽업대기',
  pickup_done: '픽업완료',
};

export const ORDER_BUCKET_STATUSES: Record<OrderBucket, OrderStatus[]> = {
  received: ['pending', 'paid', 'accepted', 'picking'],
  shipping: ['shipped'],
  pickup_waiting: ['arrived', 'ready'],
  pickup_done: ['completed'],
};

export const ORDER_BUCKET_ORDER: OrderBucket[] = [
  'received',
  'shipping',
  'pickup_waiting',
  'pickup_done',
];

export function bucketOf(status: OrderStatus): OrderBucket | null {
  for (const b of ORDER_BUCKET_ORDER) {
    if (ORDER_BUCKET_STATUSES[b].includes(status)) return b;
  }
  return null;
}
