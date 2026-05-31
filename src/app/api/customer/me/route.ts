import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { customers, users } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { ensureCustomerForUser } from '@/lib/orders/ensure-customer';

export const dynamic = 'force-dynamic';

/**
 * 로그인한 고객의 프로필 (users + customers 결합).
 * 마이페이지에서 본인 정보 확인용. admin/master 로 로그인했을 때도 customer 레코드 보장.
 */
export async function GET() {
  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const customerId = me.customerId ?? (await ensureCustomerForUser(me.id));

  const [row] = await db
    .select({
      id: customers.id,
      userId: customers.userId,
      name: customers.name,
      gender: customers.gender,
      birthDate: customers.birthDate,
      phone: customers.phone,
      landlinePhone: customers.landlinePhone,
      postalCode: customers.postalCode,
      addressLine1: customers.addressLine1,
      addressLine2: customers.addressLine2,
      memberType: customers.memberType,
      referrerCode: customers.referrerCode,
      referredByCode: customers.referredByCode,
      createdAt: customers.createdAt,
      email: users.email,
      username: users.username,
    })
    .from(customers)
    .innerJoin(users, eq(users.id, customers.userId))
    .where(eq(customers.id, customerId))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: '고객 정보를 찾을 수 없습니다.' }, { status: 404 });
  }

  return NextResponse.json({ customer: row });
}
