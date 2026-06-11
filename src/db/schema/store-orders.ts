import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { stores } from './stores';

/**
 * 가맹점 → 본사(퍼니뷰) B2B 발주 (store purchase orders).
 *
 * ⚠️ 고객 픽업주문(orders) 과 완전히 별개의 개념이다.
 *   - orders          : 고객 → 가맹점 픽업 (소비자가 retail)
 *   - store_orders    : 가맹점 → 본사 콘택트렌즈 발주 (공급가 supply price)
 *
 * 금액은 모두 **공급가(supply price)** 기준이며, 소비자 retail 가격과 절대 혼용 금지.
 * 라인 항목은 스냅샷(brand/productName/productCode/unitSupplyPrice)을 저장하여
 * 이후 제품/가격이 바뀌어도 과거 발주 기록이 그대로 보존된다.
 */
export const storeOrders = pgTable(
  'store_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    // 발주번호 (예: SO-20260610-001)
    orderNumber: text('order_number').notNull(),
    // 'placed' | 'confirmed' | 'shipped' | 'received' | 'cancelled'
    status: text('status').notNull().default('placed'),
    // 발주 총 공급금액 (원, KRW) — 라인 lineTotal 합계
    totalSupplyAmount: integer('total_supply_amount').notNull().default(0),
    note: text('note'),
    // 발주 생성자 (users.id) — 대표자/안경사
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    storeCreatedIdx: index('store_orders_store_created_idx').on(
      t.storeId,
      t.createdAt.desc(),
    ),
  }),
);

export type StoreOrder = typeof storeOrders.$inferSelect;
export type NewStoreOrder = typeof storeOrders.$inferInsert;

/**
 * 가맹점 발주 라인 항목.
 * 제품 마스터(lenses)의 스냅샷을 저장 — 과거 발주의 정합성 유지.
 */
export const storeOrderItems = pgTable(
  'store_order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => storeOrders.id, { onDelete: 'cascade' }),
    lensId: uuid('lens_id').notNull(),
    // 도수(variant) 단위 발주 — 기존 행(제품 단위) 호환 위해 nullable.
    variantId: uuid('variant_id'),
    // 스냅샷
    brand: text('brand'),
    productName: text('product_name'),
    productCode: text('product_code'),
    // 도수 스냅샷 (variant 에서 복사) — 제품/도수가 바뀌어도 발주 기록 보존
    sphere: text('sphere'),
    cylinder: text('cylinder'),
    axis: integer('axis'),
    addPower: text('add_power'),
    quantity: integer('quantity').notNull(),
    // 공급가 단가 (원, KRW) — 서버에서 재해석한 값
    unitSupplyPrice: integer('unit_supply_price').notNull(),
    // 라인 합계 = unitSupplyPrice × quantity
    lineTotal: integer('line_total').notNull(),
  },
  (t) => ({
    orderIdx: index('store_order_items_order_idx').on(t.orderId),
  }),
);

export type StoreOrderItem = typeof storeOrderItems.$inferSelect;
export type NewStoreOrderItem = typeof storeOrderItems.$inferInsert;
