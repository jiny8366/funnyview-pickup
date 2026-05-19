import { sql } from 'drizzle-orm';
import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * 제품 브랜드 마스터.
 *
 * 사용자 요구 (확정 2026-05-19):
 *  - 제품 등록 시 브랜드 input 옆 '등록' 버튼 → 모달 ('브랜드 관리')
 *  - 모달 입력 필드: 영문명 / 국문명 / 영문약자(3자)
 *  - 등록된 브랜드는 제품 등록 폼의 드롭다운에 노출
 *
 * lenses.brand (text) 는 호환을 위해 그대로 유지 — 폼에서 선택 시
 * brands.nameKo 값을 lenses.brand 컬럼에 저장. 추후 lenses.brandId
 * FK 도입 가능.
 */
export const brands = pgTable(
  'brands',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nameKo: text('name_ko').notNull(),
    nameEn: text('name_en').notNull(),
    code: text('code').notNull(), // 3자 영문 약자 (예: CHR, ACU)
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
    nameKoIdx: uniqueIndex('brands_name_ko_idx')
      .on(t.nameKo)
      .where(sql`deleted_at IS NULL`),
    codeIdx: uniqueIndex('brands_code_idx')
      .on(t.code)
      .where(sql`deleted_at IS NULL`),
  }),
);

export type Brand = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;
