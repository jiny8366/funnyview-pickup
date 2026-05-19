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
 * 제품 시리즈/모델 코드 마스터.
 *
 * 사용자 요구 (확정 2026-05-19):
 *  - 제품 등록 폼의 '제품 코드' input 옆 '등록' 버튼 → 모달
 *  - 모달 입력: 영문명 / 국문명 / 영문약자(3자) + 구분자(2자)
 *  - 등록 리스트는 영문명 정렬
 *  - 행 클릭 시 productCode 자동 조합: `{brand.code}-{product.code}{product.suffix}`
 *    (예: CHR-OOL1D = 크리스틴 / 원앤온리 / 원데이)
 *
 * lenses.productCode 는 자유 텍스트 그대로 유지 — 모달 선택 시 위 조합을 채워줌.
 */
export const productCodes = pgTable(
  'product_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nameKo: text('name_ko').notNull(),
    nameEn: text('name_en').notNull(),
    code: text('code').notNull(), // 3자 영문 약자 (예: OOL, BIO)
    suffix: text('suffix').notNull(), // 2자 구분자 (예: 1D, 2W, BR)
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
    nameKoIdx: uniqueIndex('product_codes_name_ko_idx')
      .on(t.nameKo)
      .where(sql`deleted_at IS NULL`),
    // code+suffix 조합이 5자 unique
    codeSuffixIdx: uniqueIndex('product_codes_code_suffix_idx')
      .on(t.code, t.suffix)
      .where(sql`deleted_at IS NULL`),
  }),
);

export type ProductCode = typeof productCodes.$inferSelect;
export type NewProductCode = typeof productCodes.$inferInsert;
