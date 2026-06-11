import {
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { lensVariants } from './lenses';
import { suppliers } from './inventory';
import { users } from './users';

/**
 * 본사(퍼니뷰) → 매입처 발주 (매입 관리 — JINY).
 *
 * ⚠️ 용어 주의 — 세 가지 '발주/주문' 구분:
 *   · orders          : 고객 → 가맹점 픽업 주문
 *   · store_orders    : 가맹점 → 본사 B2B 발주
 *   · supplier_orders : 본사 → 매입처 발주 (이 테이블)
 *
 * 흐름: 보충 후보(출고분 + 안전재고 미달) → 매입처 선택·수량 조정 → 발주서 생성(ordered)
 *       → staff 입고에서 불러와 입고 처리 → received 마킹.
 * ordered 상태 발주에 포함된 도수는 다음 보충 후보 리스트에서 제외된다.
 */
export const supplierOrders = pgTable(
  'supplier_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // 발주번호 (예: PO-20260612-001)
    orderNumber: text('order_number').notNull(),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.id),
    // 'ordered'(발주완료) | 'received'(입고완료) | 'cancelled'
    status: text('status').notNull().default('ordered'),
    // 예상 매입금액 합계 (원, 참고용 — 실원가는 입고 로트 기준 FIFO)
    totalCost: integer('total_cost').notNull().default(0),
    note: text('note'),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }),
  },
  (t) => ({
    orderNumberUnique: uniqueIndex('supplier_orders_order_number_unique').on(t.orderNumber),
    supplierIdx: index('supplier_orders_supplier_idx').on(t.supplierId, t.createdAt),
    statusIdx: index('supplier_orders_status_idx').on(t.status, t.createdAt),
  }),
);

export const supplierOrderItems = pgTable(
  'supplier_order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => supplierOrders.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => lensVariants.id),
    // 스냅샷 (발주 시점 표기 보존)
    brand: text('brand'),
    productName: text('product_name'),
    sku: text('sku'),
    sphere: text('sphere'),
    cylinder: text('cylinder'),
    axis: integer('axis'),
    addPower: text('add_power'),
    quantity: integer('quantity').notNull(),
    // 예상 매입단가 (원, 참고 — 표준매입가 기반, 화면에서 조정 가능)
    unitCost: integer('unit_cost').notNull().default(0),
  },
  (t) => ({
    orderIdx: index('supplier_order_items_order_idx').on(t.orderId),
    variantIdx: index('supplier_order_items_variant_idx').on(t.variantId),
  }),
);

export type SupplierOrder = typeof supplierOrders.$inferSelect;
export type SupplierOrderItem = typeof supplierOrderItems.$inferSelect;

/**
 * 과거 판매데이터 (엑셀 업로드 — JINY).
 * 시스템 도입 전 판매 이력을 안전재고 권고의 수요 참조데이터로 활용.
 * 업로드 시 제품명+도수 → variant 매칭·검수를 통과한 행만 저장된다.
 */
export const historicalSales = pgTable(
  'historical_sales',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => lensVariants.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull(),
    soldOn: date('sold_on').notNull(),
    uploadedBy: uuid('uploaded_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    variantSoldIdx: index('historical_sales_variant_sold_idx').on(t.variantId, t.soldOn),
    soldOnIdx: index('historical_sales_sold_on_idx').on(t.soldOn),
  }),
);

export type HistoricalSale = typeof historicalSales.$inferSelect;
