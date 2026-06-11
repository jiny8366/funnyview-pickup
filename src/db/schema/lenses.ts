import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { lensTypeEnum, replacementCycleEnum } from './enums';

/**
 * 콘택트렌즈 제품 마스터 (브랜드/제품군 단위).
 * 도수별 SKU 는 lens_variants 에 저장.
 */
export const lenses = pgTable(
  'lenses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productCode: text('product_code').notNull(), // 내부 제품 코드
    brand: text('brand').notNull(),
    name: text('name').notNull(),
    lensType: lensTypeEnum('lens_type').notNull(),
    replacementCycle: replacementCycleEnum('replacement_cycle').notNull(),

    // 렌즈 스펙
    baseCurve: numeric('base_curve', { precision: 4, scale: 2 }), // BC
    diameter: numeric('diameter', { precision: 4, scale: 2 }), // DIA
    waterContent: numeric('water_content', { precision: 5, scale: 2 }), // 함수율 %
    material: text('material'),
    oxygenDkt: integer('oxygen_dkt'), // 산소투과율 Dk/t (착용시간 추천 지표)
    uvProtection: boolean('uv_protection').default(false).notNull(), // UV 차단 여부
    blueLight: boolean('blue_light').default(false).notNull(), // 블루라이트 차단 여부

    // 박스 단위
    piecesPerBox: integer('pieces_per_box').default(1).notNull(), // 1박스 매수

    // 도수 범위 (lens_variants 생성 가이드)
    sphereMin: numeric('sphere_min', { precision: 4, scale: 2 }),
    sphereMax: numeric('sphere_max', { precision: 4, scale: 2 }),
    sphereStep: numeric('sphere_step', { precision: 4, scale: 2 }).default(
      '0.25',
    ),
    cylinderMin: numeric('cylinder_min', { precision: 4, scale: 2 }),
    cylinderMax: numeric('cylinder_max', { precision: 4, scale: 2 }),
    cylinderStep: numeric('cylinder_step', { precision: 4, scale: 2 }).default(
      '0.25',
    ),
    axisStep: integer('axis_step').default(10), // 축 간격

    // 가격 — 모든 금액은 부가세 포함 (한국 회계 관행, 확정 2026-05-19)
    // 기존 price/cost 는 호환 위해 유지 (NULL 가능)
    price: integer('price').notNull(), // 판매가 (호환) — 신규는 recommendedRetailPrice 사용
    cost: integer('cost'), // 원가 (호환) — 신규는 standardCost 사용

    // 매입 (제조사 → 본사)
    standardCost: integer('standard_cost'), // 표준매입가
    purchaseDiscountAmount: integer('purchase_discount_amount').default(0), // 매입할인 금액
    purchaseDiscountPercent: integer('purchase_discount_percent').default(0), // 매입할인 % (0-100)

    // 공급 (본사 → 가맹점)
    standardSupplyPrice: integer('standard_supply_price'), // 표준공급가 (= 가맹점 공급가)
    supplyDiscountAmount: integer('supply_discount_amount').default(0), // 공급할인 금액
    supplyDiscountPercent: integer('supply_discount_percent').default(0), // 공급할인 % (0-100)

    // 소비자 (가맹점 → 소비자)
    recommendedRetailPrice: integer('recommended_retail_price'), // 권장소비자가

    // 식약처 UDI 참조 (1회/분기 일괄 적재, 런타임 호출 없음)
    mfdsPermitNo: text('mfds_permit_no'), // 품목허가번호 (예: '제조허가 21-1234')
    mfdsClassificationCode: text('mfds_classification_code'), // 분류번호 (A07020)
    mfdsProductName: text('mfds_product_name'), // 식약처 등록 품목명 (법적 표시용)
    manufacturer: text('manufacturer'), // 제조원
    udiSyncedAt: timestamp('udi_synced_at', { withTimezone: true }), // 마지막 UDI 적재 시각

    imageUrl: text('image_url'),
    videoUrl: text('video_url'), // 대표 영상 (YouTube/Vimeo 링크 또는 self-hosted 경로)
    description: text('description'),

    // 카페24 스타일 상품 카드 표시
    colorName: text('color_name'), // '브라운', '글로우 블랙' 등
    colorHex: text('color_hex'), // CSS 색상 (#8B5A2B 등) — 미리보기 원
    colorPreviewUrl: text('color_preview_url'), // 실제 렌즈 컬러 이미지 (URL 우선)
    seriesCode: text('series_code'), // 시리즈 그룹화 ('CHRISTIN-1DAY' 등 — 컬러 묶음)
    isNew: boolean('is_new').default(false).notNull(), // NEW 뱃지 표시

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
    productCodeUnique: uniqueIndex('lenses_product_code_unique').on(
      t.productCode,
    ),
    brandIdx: index('lenses_brand_idx').on(t.brand),
    activeIdx: index('lenses_active_idx').on(t.isActive),
    seriesIdx: index('lenses_series_idx').on(t.seriesCode),
  }),
);

/**
 * 도수별 SKU.
 * (lens_id, sphere, cylinder, axis, add_power) 조합이 유일.
 * NULL 도 NOT DISTINCT 로 동등 비교 (PG 15+).
 */
export const lensVariants = pgTable(
  'lens_variants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    lensId: uuid('lens_id')
      .notNull()
      .references(() => lenses.id, { onDelete: 'cascade' }),
    sku: text('sku').notNull(), // 내부 SKU 코드 (예: ACU-OAS-S-100-C-075-A-180)

    sphere: numeric('sphere', { precision: 4, scale: 2 }).notNull(), // 원용
    cylinder: numeric('cylinder', { precision: 4, scale: 2 }), // 난시
    axis: integer('axis'), // 축
    addPower: numeric('add_power', { precision: 4, scale: 2 }), // 가입도

    // UDI-DI (GTIN-13) — 도수별 SKU 의 식약처 표준코드
    // lens_barcodes 와 의도된 비정규화: 입출고 스캔 시 JOIN 회피 + admin UI 표시 용이
    udiDi: text('udi_di'),

    // 가격 오버라이드 (도수별 가격이 다른 경우)
    priceOverride: integer('price_override'),

    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    // SKU 자체가 유일하므로 (lensId, sph, cyl, axis, add) 결정적 생성을 통해 중복 방지.
    skuUnique: uniqueIndex('lens_variants_sku_unique').on(t.sku),
    udiDiUnique: uniqueIndex('lens_variants_udi_di_unique').on(t.udiDi),
    lensIdx: index('lens_variants_lens_idx').on(t.lensId),
    sphereIdx: index('lens_variants_sphere_idx').on(
      t.lensId,
      t.sphere,
      t.cylinder,
      t.axis,
    ),
  }),
);

/**
 * 바코드 (SKU 1개당 N개 가능 — 제조사/유통 바코드 분리).
 */
export const lensBarcodes = pgTable(
  'lens_barcodes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => lensVariants.id, { onDelete: 'cascade' }),
    barcode: text('barcode').notNull(),
    barcodeType: text('barcode_type'), // 'EAN13' | 'CODE128' | 'QR' | 'manufacturer'
    isPrimary: boolean('is_primary').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    barcodeUnique: uniqueIndex('lens_barcodes_barcode_unique').on(t.barcode),
    variantIdx: index('lens_barcodes_variant_idx').on(t.variantId),
  }),
);

export type Lens = typeof lenses.$inferSelect;
export type NewLens = typeof lenses.$inferInsert;
export type LensVariant = typeof lensVariants.$inferSelect;
export type NewLensVariant = typeof lensVariants.$inferInsert;
export type LensBarcode = typeof lensBarcodes.$inferSelect;
export type NewLensBarcode = typeof lensBarcodes.$inferInsert;
