import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { lenses } from './lenses';

/**
 * 제품 프로모션 — 기간/조건부 가격.
 *
 * 사용자 요구 (확정 2026-05-19):
 *  - sale: 할인판매가 (가맹점 등급별 + 기간)
 *  - promotion: 프로모션가 (기간 — 한정 행사)
 *  - volume_bundle: 1+1, 2+1 등 (기준 구매 갯수 + 무료 갯수, 원가율에 반영)
 *
 * 가격 단위 = 부가세 포함 (한국 회계 관행). UI 표시 시 부가세 별도 환산 가능.
 */
export const lensPromotions = pgTable(
  'lens_promotions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    lensId: uuid('lens_id')
      .notNull()
      .references(() => lenses.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(), // 'sale' | 'promotion' | 'volume_bundle'

    // sale / promotion: 할인 가격 (둘 중 하나 사용)
    discountAmount: integer('discount_amount').default(0), // 할인 금액
    discountPercent: integer('discount_percent').default(0), // 할인 % (0-100)

    // sale 전용: 가맹점 등급 (NULL = 전체 가맹점)
    storeTier: text('store_tier'),

    // volume_bundle 전용: 1+1 → buyQty=1, freeQty=1
    buyQty: integer('buy_qty'),
    freeQty: integer('free_qty'),

    // 기간 (NULL = 무기한)
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),

    isActive: boolean('is_active').default(true).notNull(),
    note: text('note'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    lensIdx: index('lens_promotions_lens_idx').on(t.lensId),
    kindIdx: index('lens_promotions_kind_idx').on(t.kind),
    activeIdx: index('lens_promotions_active_idx').on(t.isActive, t.startsAt, t.endsAt),
  }),
);

export type LensPromotion = typeof lensPromotions.$inferSelect;
export type NewLensPromotion = typeof lensPromotions.$inferInsert;
