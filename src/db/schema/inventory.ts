import {
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { inventoryMovementTypeEnum } from './enums';
import { lenses, lensVariants } from './lenses';
import { users } from './users';

/**
 * 픽업서비스 업체(중앙 창고)의 SKU별 현재 재고.
 * available = quantity_on_hand - quantity_reserved (계산 컬럼은 미사용, 쿼리에서 계산)
 */
export const inventory = pgTable(
  'inventory',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => lensVariants.id, { onDelete: 'cascade' }),
    quantityOnHand: integer('quantity_on_hand').default(0).notNull(),
    quantityReserved: integer('quantity_reserved').default(0).notNull(),
    safetyStock: integer('safety_stock').default(0).notNull(), // 안전재고 (이하 시 알람)
    reorderPoint: integer('reorder_point').default(0).notNull(), // 발주점
    location: text('location'), // 창고 위치 코드 (예: A-12-3)
    lastCountedAt: timestamp('last_counted_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    variantUnique: uniqueIndex('inventory_variant_unique').on(t.variantId),
    onHandIdx: index('inventory_on_hand_idx').on(t.quantityOnHand),
    onHandNonNegative: check(
      'inventory_on_hand_non_negative',
      sql`${t.quantityOnHand} >= 0`,
    ),
    reservedNonNegative: check(
      'inventory_reserved_non_negative',
      sql`${t.quantityReserved} >= 0`,
    ),
  }),
);

/**
 * 입고 전표 헤더 (확정 2026-05-22).
 * 1전표 = 1제품(lens) × 1입고일 × N개 도수 품목.
 * 도수별 수량/단가는 inventory_lots 에 행별로 저장.
 *
 * status: draft → confirmed (확정 시 inventory_lots 와 inventory.quantityOnHand 반영)
 */
export const inboundShipments = pgTable(
  'inbound_shipments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    lensId: uuid('lens_id')
      .notNull()
      .references(() => lenses.id),
    inboundDate: date('inbound_date').notNull(), // 실물 입고일 (FIFO 순서 기준)
    supplierId: uuid('supplier_id'), // 추후 suppliers 테이블 FK
    invoiceRef: text('invoice_ref'), // 세금계산서/거래명세서 번호
    note: text('note'),
    status: text('status').default('draft').notNull(), // 'draft' | 'confirmed'
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    lensIdx: index('inbound_shipments_lens_idx').on(t.lensId),
    dateIdx: index('inbound_shipments_date_idx').on(t.inboundDate),
    statusIdx: index('inbound_shipments_status_idx').on(t.status),
  }),
);

/**
 * 입고 로트 원장 (확정 2026-05-22).
 * 도수(variantId) 단위로 입고 수량·단가 기록 + FIFO 잔여 추적.
 *
 * - 같은 lens_variant 라도 입고일/단가가 다르면 별도 로트 행.
 * - 출고 시 inboundDate ASC 정렬로 가장 오래된 로트부터 quantityRemaining 차감.
 * - 동일 도수에 단가가 다른 경우 가중평균으로 unit_cost 계산해 order_items 에 기록.
 */
export const inventoryLots = pgTable(
  'inventory_lots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shipmentId: uuid('shipment_id')
      .notNull()
      .references(() => inboundShipments.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => lensVariants.id),
    quantityReceived: integer('quantity_received').notNull(),
    quantityRemaining: integer('quantity_remaining').notNull(), // 초기 = quantityReceived
    unitCostIncVat: integer('unit_cost_inc_vat').notNull(), // 단위 입고가 (부가세 포함, KRW)
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    variantIdx: index('inventory_lots_variant_idx').on(t.variantId),
    shipmentIdx: index('inventory_lots_shipment_idx').on(t.shipmentId),
    remainingIdx: index('inventory_lots_remaining_idx').on(t.quantityRemaining),
    qtyReceivedPositive: check(
      'inventory_lots_qty_received_positive',
      sql`${t.quantityReceived} > 0`,
    ),
    qtyRemainingNonNegative: check(
      'inventory_lots_qty_remaining_non_negative',
      sql`${t.quantityRemaining} >= 0`,
    ),
    qtyRemainingLeReceived: check(
      'inventory_lots_qty_remaining_le_received',
      sql`${t.quantityRemaining} <= ${t.quantityReceived}`,
    ),
    unitCostNonNegative: check(
      'inventory_lots_unit_cost_non_negative',
      sql`${t.unitCostIncVat} >= 0`,
    ),
  }),
);

/**
 * 입출고 이력 (Append-only).
 * 모든 재고 변동의 단일 진실 원천. 재고 수량은 이 테이블의 합산으로 재계산 가능.
 *
 * lotId, unitCostSnapshot 컬럼 추가 (확정 2026-05-22, FIFO 도입):
 *  - lotId: outbound/reserve/release/adjust/return 시 어느 로트가 소진/복원됐는지
 *  - unitCostSnapshot: 그 시점 로트 단가 (로트 수정 후에도 이력 보존)
 */
export const inventoryMovements = pgTable(
  'inventory_movements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => lensVariants.id),
    movementType: inventoryMovementTypeEnum('movement_type').notNull(),
    quantity: integer('quantity').notNull(), // 부호 포함 (입고+ / 출고-)

    // FIFO 로트 추적
    lotId: uuid('lot_id').references(() => inventoryLots.id),
    unitCostSnapshot: integer('unit_cost_snapshot'),

    // 참조 (다형성)
    referenceType: text('reference_type'), // 'order' | 'inbound' | 'adjustment' | 'return'
    referenceId: uuid('reference_id'),

    note: text('note'),
    performedBy: uuid('performed_by').references(() => users.id),
    performedAt: timestamp('performed_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    variantIdx: index('inventory_movements_variant_idx').on(
      t.variantId,
      t.performedAt,
    ),
    referenceIdx: index('inventory_movements_reference_idx').on(
      t.referenceType,
      t.referenceId,
    ),
    performedAtIdx: index('inventory_movements_performed_at_idx').on(
      t.performedAt,
    ),
    lotIdx: index('inventory_movements_lot_idx').on(t.lotId),
  }),
);

export type Inventory = typeof inventory.$inferSelect;
export type NewInventory = typeof inventory.$inferInsert;
export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type NewInventoryMovement = typeof inventoryMovements.$inferInsert;
export type InboundShipment = typeof inboundShipments.$inferSelect;
export type NewInboundShipment = typeof inboundShipments.$inferInsert;
export type InventoryLot = typeof inventoryLots.$inferSelect;
export type NewInventoryLot = typeof inventoryLots.$inferInsert;
