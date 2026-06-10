import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { lensVariants } from './lenses';
import { orders } from './orders';
import { users } from './users';

/**
 * 급매입 리스트 — 패킹 검수 중 실물 부족 발생 시 등록 (JINY 확정 플로우).
 * 주문은 picking(처리 중) 유지 → 어드민이 급매입 처리(발주→입고) → 재검수 → 배송처리.
 * status: requested(대기) → ordered(발주됨) → received(입고완료) / cancelled
 */
export const urgentPurchases = pgTable('urgent_purchases', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id), // 부족이 발생한 주문
  variantId: uuid('variant_id')
    .notNull()
    .references(() => lensVariants.id),
  quantityShort: integer('quantity_short').notNull(), // 부족 수량(박스)
  status: text('status').notNull().default('requested'), // requested|ordered|received|cancelled
  note: text('note'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});

export type UrgentPurchase = typeof urgentPurchases.$inferSelect;
