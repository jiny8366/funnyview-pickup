import { integer, pgTable, text, timestamp, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * 사업장(발행자) 정보 — singleton (id=1 한 행).
 * 거래명세서/송장 발행자, 푸터 사업자표기, 약관 플레이스홀더의 단일 출처.
 * (보드 #18 — 스키마: M3, GET/PUT API·admin 폼: W1, 폼 레이아웃: M1)
 */
export const businessInfo = pgTable(
  'business_info',
  {
    id: integer('id').primaryKey().default(1),
    companyName: text('company_name').notNull().default('(주)퍼니뷰'),
    serviceName: text('service_name').notNull().default('퍼니뷰 예약시스템'),
    bizNo: text('biz_no'), // 사업자등록번호
    ceo: text('ceo'), // 대표자
    address: text('address'), // 영업소 소재지
    phone: text('phone'),
    email: text('email'),
    mailOrderNo: text('mail_order_no'), // 통신판매업 신고번호
    privacyOfficer: text('privacy_officer'), // 개인정보보호책임자 (약관 표기)
    sealUrl: text('seal_url'), // 명세서 직인 이미지
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    singleton: check('business_info_singleton', sql`${t.id} = 1`),
  }),
);

export type BusinessInfo = typeof businessInfo.$inferSelect;
