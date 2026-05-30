import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { customers } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { findCustomerIdForUser } from '@/lib/orders/ensure-customer';
import { recommendSchema } from '@/lib/prescription/schema';
import { ageFromBirthDate, recommendLenses } from '@/lib/prescription/recommend';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = recommendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다.' }, { status: 400 });
  }
  const customerId = await findCustomerIdForUser(me.id);
  let age: number | null = null;
  if (customerId) {
    const [c] = await db
      .select({ birthDate: customers.birthDate })
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);
    age = ageFromBirthDate(c?.birthDate);
  }
  const recommendations = await recommendLenses(parsed.data.dose, parsed.data.lifestyle, age);
  return NextResponse.json({ recommendations, age });
}
