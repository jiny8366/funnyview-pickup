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
 * 제품 가격 시계열 — 매입/공급/소비자 가격의 변경 이력.
 *
 * 사용자 요구 (확정 2026-05-19):
 *  - 가격 변경 시 "언제부터 적용" 지정 가능 (startsAt)
 *  - "언제까지" 미지정이면 다음 변경 전까지 유지 (endsAt = NULL)
 *  - 매입/공급/소비자 모두 동일 패턴
 *
 * 운영 모델:
 *  - lenses 의 standardCost/standardSupplyPrice/recommendedRetailPrice 는
 *    현재 시점에 적용되는 캐시 값.
 *  - 가격 저장 시 entries INSERT + 시작일 ≤ now 면 캐시도 갱신.
 *  - 미래 시작일이면 entries 만 INSERT (예약). 추후 cron/lazy 로 캐시 갱신.
 *
 * 모든 금액은 부가세 포함 (KRW 정수).
 */
export const lensPriceEntries = pgTable(
  'lens_price_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    lensId: uuid('lens_id')
      .notNull()
      .references(() => lenses.id, { onDelete: 'cascade' }),
    scope: text('scope').notNull(), // 'purchase' | 'supply' | 'retail'

    standard: integer('standard').notNull(), // 표준가 (purchase/supply: 매입/공급 / retail: 권장소비자가)
    discountAmount: integer('discount_amount').default(0), // 할인 금액 (retail 은 0 권장)
    discountPercent: integer('discount_percent').default(0), // 할인 % (0-100)

    startsAt: timestamp('starts_at', { withTimezone: true }).defaultNow().notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }), // NULL = 무기한

    isActive: boolean('is_active').default(true).notNull(),
    note: text('note'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    lensScopeIdx: index('lens_price_entries_lens_scope_idx').on(t.lensId, t.scope),
    activeIdx: index('lens_price_entries_active_idx').on(t.isActive, t.startsAt, t.endsAt),
  }),
);

export type LensPriceEntry = typeof lensPriceEntries.$inferSelect;
export type NewLensPriceEntry = typeof lensPriceEntries.$inferInsert;

export const PRICE_SCOPES = ['purchase', 'supply', 'retail'] as const;
export type PriceScope = (typeof PRICE_SCOPES)[number];
