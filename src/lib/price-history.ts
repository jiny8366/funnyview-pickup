/**
 * 가격 변동 이력 조회 — 각 entry 와 직전 entry 비교한 변동 계산.
 */
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { lensPriceEntries, lenses, users, type PriceScope } from '@/db/schema';

export interface PriceHistoryRow {
  id: string;
  lensId: string;
  productName: string; // "{brand} {name}"
  productCode: string;
  scope: PriceScope;
  scopeLabel: string;
  standard: number;
  discountAmount: number;
  discountPercent: number;
  effective: number; // standard 에 할인 적용한 실효가
  prevEffective: number | null; // 직전 entry 의 effective (없으면 null)
  delta: number | null; // effective - prevEffective
  startsAt: string;
  endsAt: string | null;
  createdAt: string;
  createdBy: string | null;
  createdByLabel: string; // username/email/phone 등 표시명
}

const SCOPE_LABEL: Record<PriceScope, string> = {
  purchase: '매입',
  supply: '공급',
  retail: '소비자',
};

function calcEffective(standard: number, da: number, dp: number): number {
  const afterPercent = Math.round(standard * (1 - Math.max(0, Math.min(100, dp)) / 100));
  return Math.max(0, afterPercent - Math.max(0, da));
}

export interface PriceHistoryQuery {
  limit?: number;
  offset?: number;
  lensId?: string;
  scope?: PriceScope;
}

export async function fetchPriceHistory(q: PriceHistoryQuery = {}): Promise<PriceHistoryRow[]> {
  const limit = Math.min(500, Math.max(1, q.limit ?? 100));
  const offset = Math.max(0, q.offset ?? 0);

  // 전체 활성 entries (필터 적용) — 시간 역순
  const where = [isNull(lensPriceEntries.deletedAt)];
  if (q.lensId) where.push(eq(lensPriceEntries.lensId, q.lensId));
  if (q.scope) where.push(eq(lensPriceEntries.scope, q.scope));

  const entries = await db
    .select({
      id: lensPriceEntries.id,
      lensId: lensPriceEntries.lensId,
      scope: lensPriceEntries.scope,
      standard: lensPriceEntries.standard,
      discountAmount: lensPriceEntries.discountAmount,
      discountPercent: lensPriceEntries.discountPercent,
      startsAt: lensPriceEntries.startsAt,
      endsAt: lensPriceEntries.endsAt,
      createdAt: lensPriceEntries.createdAt,
      createdBy: lensPriceEntries.createdBy,
    })
    .from(lensPriceEntries)
    .where(and(...where))
    .orderBy(desc(lensPriceEntries.createdAt))
    .limit(limit)
    .offset(offset);

  if (entries.length === 0) return [];

  // 제품 정보 join
  const lensIds = Array.from(new Set(entries.map((e) => e.lensId)));
  const lensRows = await db
    .select({
      id: lenses.id,
      brand: lenses.brand,
      name: lenses.name,
      productCode: lenses.productCode,
    })
    .from(lenses)
    .where(inArray(lenses.id, lensIds));
  const lensMap = new Map(lensRows.map((l) => [l.id, l]));

  // 담당자 join
  const userIds = Array.from(
    new Set(entries.map((e) => e.createdBy).filter((x): x is string => !!x)),
  );
  const userRows = userIds.length
    ? await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          phone: users.phone,
        })
        .from(users)
        .where(inArray(users.id, userIds))
    : [];
  const userMap = new Map(userRows.map((u) => [u.id, u]));

  // 각 entry 의 직전 effective 계산 — 같은 lensId + scope 의 더 이른 createdAt entry 의 effective
  // 매 entry 마다 별도 query 는 비효율 → 메모리에서 그룹화 (limit 작을 때 안전)
  const byKey: Map<string, typeof entries> = new Map();
  for (const e of entries) {
    const key = `${e.lensId}|${e.scope}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(e);
  }
  // 각 group 안에서 createdAt 역순 (이미) — 다음 element 가 직전 (이전 시점)

  const prevMap = new Map<string, number>();
  for (const [key, list] of byKey.entries()) {
    // list 는 createdAt 역순 — [0] 이 가장 최신, [1] 이 그 직전
    for (let i = 0; i < list.length; i++) {
      const next = list[i + 1];
      if (next) {
        const prevEff = calcEffective(
          next.standard,
          next.discountAmount ?? 0,
          next.discountPercent ?? 0,
        );
        prevMap.set(list[i].id, prevEff);
      }
    }
  }

  return entries.map((e): PriceHistoryRow => {
    const lens = lensMap.get(e.lensId);
    const u = e.createdBy ? userMap.get(e.createdBy) : null;
    const eff = calcEffective(e.standard, e.discountAmount ?? 0, e.discountPercent ?? 0);
    const prev = prevMap.get(e.id) ?? null;
    return {
      id: e.id,
      lensId: e.lensId,
      productName: lens ? `${lens.brand} ${lens.name}` : '(삭제된 제품)',
      productCode: lens?.productCode ?? '—',
      scope: e.scope as PriceScope,
      scopeLabel: SCOPE_LABEL[e.scope as PriceScope] ?? e.scope,
      standard: e.standard,
      discountAmount: e.discountAmount ?? 0,
      discountPercent: e.discountPercent ?? 0,
      effective: eff,
      prevEffective: prev,
      delta: prev != null ? eff - prev : null,
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt?.toISOString() ?? null,
      createdAt: e.createdAt.toISOString(),
      createdBy: e.createdBy ?? null,
      createdByLabel: u
        ? u.email ?? u.username ?? u.phone ?? '(이름 없음)'
        : '(시스템)',
    };
  });
}
