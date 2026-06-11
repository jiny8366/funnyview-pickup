import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { lenses } from './lenses';

/**
 * 픽업가맹점 그룹.
 * 그룹 단위 운영 설정(수수료율 등)을 매장에 fallback 으로 적용한다.
 *
 * 효과 수수료율 = 매장 자체율 우선, 없으면(0 또는 null) 그룹율.
 * (stores 가 group_id 로 참조하므로 stores 위에 선언한다.)
 */
export const storeGroups = pgTable('store_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(), // 그룹명
  // 그룹 기본 수수료율 (%) — 소속 매장의 fallback
  commissionRate: numeric('commission_rate', { precision: 5, scale: 2 })
    .default('0')
    .notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  memo: text('memo'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type StoreGroup = typeof storeGroups.$inferSelect;
export type NewStoreGroup = typeof storeGroups.$inferInsert;

/**
 * 픽업가맹점 마스터.
 * 카카오맵/네이버지도/T맵 URL 은 미리 저장 가능, 미저장 시 lat/lng 로 동적 생성.
 */
export const stores = pgTable(
  'stores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(), // 가맹점 코드 (예: ST-0001)
    name: text('name').notNull(), // 가맹점명
    phone: text('phone').notNull(), // 가맹점 전화번호

    // 주소
    postalCode: text('postal_code'),
    addressLine1: text('address_line1').notNull(),
    addressLine2: text('address_line2'),
    latitude: numeric('latitude', { precision: 10, scale: 7 }),
    longitude: numeric('longitude', { precision: 10, scale: 7 }),

    // 지도 URL (선택, 없으면 lat/lng 로 동적 생성)
    kakaoMapUrl: text('kakao_map_url'),
    naverMapUrl: text('naver_map_url'),
    tmapUrl: text('tmap_url'),

    // 영업 시간 — {mon: {open: '09:00', close: '19:00'}, ...}
    businessHours: jsonb('business_hours'),

    // 사업자 정보 (거래전표용)
    businessNumber: text('business_number'),
    representativeName: text('representative_name'),
    representativePhone: text('representative_phone'), // 대표 휴대전화(사업자 연락처)

    // 정산 수수료율 (%) — 픽업가맹점에 지급하는 수수료율
    commissionRate: numeric('commission_rate', { precision: 5, scale: 2 })
      .default('0')
      .notNull(),

    // 소속 그룹 (선택) — 그룹 운영 설정이 fallback 으로 적용
    groupId: uuid('group_id').references(() => storeGroups.id),

    // 픽업 처리 우선순위 (낮을수록 우선 노출)
    sortOrder: integer('sort_order').default(0).notNull(),

    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    codeUnique: uniqueIndex('stores_code_unique').on(t.code),
    nameIdx: index('stores_name_idx').on(t.name),
    activeIdx: index('stores_active_idx').on(t.isActive),
  }),
);

export type Store = typeof stores.$inferSelect;
export type NewStore = typeof stores.$inferInsert;

/**
 * 그룹 × 제품 수수료율 오버라이드.
 * 그룹 전체율보다 우선하지만, 매장 × 제품 오버라이드보다는 후순위.
 * 효과 수수료율 해석 순서는 src/lib/commission/resolve.ts 참조.
 */
export const groupProductCommissions = pgTable(
  'group_product_commissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => storeGroups.id),
    lensId: uuid('lens_id')
      .notNull()
      .references(() => lenses.id),
    commissionRate: numeric('commission_rate', { precision: 5, scale: 2 })
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    groupLensUnique: uniqueIndex('group_product_commissions_group_lens_unique').on(
      t.groupId,
      t.lensId,
    ),
  }),
);

export type GroupProductCommission = typeof groupProductCommissions.$inferSelect;
export type NewGroupProductCommission =
  typeof groupProductCommissions.$inferInsert;

/**
 * 매장 × 제품 수수료율 오버라이드.
 * 가장 구체적인 수준 — 모든 fallback(그룹×제품, 매장 전체, 그룹 전체)보다 우선.
 * 효과 수수료율 해석 순서는 src/lib/commission/resolve.ts 참조.
 */
export const storeProductCommissions = pgTable(
  'store_product_commissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    lensId: uuid('lens_id')
      .notNull()
      .references(() => lenses.id),
    commissionRate: numeric('commission_rate', { precision: 5, scale: 2 })
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    storeLensUnique: uniqueIndex('store_product_commissions_store_lens_unique').on(
      t.storeId,
      t.lensId,
    ),
  }),
);

export type StoreProductCommission = typeof storeProductCommissions.$inferSelect;
export type NewStoreProductCommission =
  typeof storeProductCommissions.$inferInsert;
