/**
 * lens_price_entries 헬퍼.
 *
 * 사용자 요구 (확정 2026-05-19):
 *  - 가격 변경 시 시작일/종료일 지정 가능
 *  - 시작일 ≤ now 면 lenses 의 캐시 컬럼도 즉시 갱신
 *  - 시작일 > now (미래 예약) 면 entries 에만 INSERT
 *  - 종료일 미지정 = 무기한 (다음 변경 전까지)
 */
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { lensPriceEntries, lenses, type PriceScope } from '@/db/schema';

export interface PriceEntryInput {
  scope: PriceScope;
  standard: number | null;
  discountAmount?: number | null;
  discountPercent?: number | null;
  startsAt?: string | null; // ISO date 또는 null (= 즉시)
  endsAt?: string | null;
  note?: string | null;
}

/**
 * 가격 entry 생성 + 캐시 갱신.
 *  - standard 가 null/0 이면 entry 생성 안 함
 *  - startsAt 미지정 → 즉시 (now)
 *  - 시작일 ≤ now 인 경우 lenses 캐시 컬럼도 갱신
 */
export async function createPriceEntryAndSyncCache(
  lensId: string,
  input: PriceEntryInput,
): Promise<void> {
  if (input.standard == null || input.standard <= 0) return;

  const startsAt = input.startsAt ? new Date(input.startsAt) : new Date();
  const endsAt = input.endsAt ? new Date(input.endsAt) : null;
  const now = new Date();

  await db.insert(lensPriceEntries).values({
    lensId,
    scope: input.scope,
    standard: input.standard,
    discountAmount: input.discountAmount ?? 0,
    discountPercent: input.discountPercent ?? 0,
    startsAt,
    endsAt,
    note: input.note ?? null,
  });

  // 시작일이 지금 이전/같음 → 캐시 즉시 갱신. 미래면 다음 cron/lazy 에서 (현재는 entries 만)
  if (startsAt.getTime() <= now.getTime()) {
    const updates: Record<string, unknown> = {};
    if (input.scope === 'purchase') {
      updates.standardCost = input.standard;
      updates.purchaseDiscountAmount = input.discountAmount ?? 0;
      updates.purchaseDiscountPercent = input.discountPercent ?? 0;
    } else if (input.scope === 'supply') {
      updates.standardSupplyPrice = input.standard;
      updates.supplyDiscountAmount = input.discountAmount ?? 0;
      updates.supplyDiscountPercent = input.discountPercent ?? 0;
    } else if (input.scope === 'retail') {
      updates.recommendedRetailPrice = input.standard;
    }
    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date();
      await db.update(lenses).set(updates).where(eq(lenses.id, lensId));
    }
  }
}
