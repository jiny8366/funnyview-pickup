import { NextResponse } from 'next/server';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { customers, orders } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { withDbRetry } from '@/lib/db/retry';

export const dynamic = 'force-dynamic';

/**
 * 가맹점 고객 검색 — 자기 매장에 픽업 주문(예약) 이력이 있는 고객만 (JINY: 예약 고객정보 확인).
 * ?q=이름/전화 검색. 고객별 주문수·최근주문일 포함.
 */
export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'store_staff' || !me.storeId) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim();

  const conds = [eq(orders.pickupStoreId, me.storeId!)];
  if (q) {
    const pat = `%${q}%`;
    const search = or(ilike(customers.name, pat), ilike(customers.phone, pat));
    if (search) conds.push(search);
  }

  const rows = await withDbRetry(() =>
    db
      .select({
        customerId: customers.id,
        name: customers.name,
        phone: customers.phone,
        orderCount: sql<number>`COUNT(${orders.id})::int`,
        lastOrderAt: sql<string>`MAX(${orders.createdAt})`,
      })
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .where(and(...conds))
      .groupBy(customers.id, customers.name, customers.phone)
      .orderBy(desc(sql`MAX(${orders.createdAt})`))
      .limit(50),
  );

  return NextResponse.json({ customers: rows });
}
