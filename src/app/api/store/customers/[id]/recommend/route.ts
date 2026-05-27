import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { customers, orders } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { recommendSchema } from '@/lib/prescription/schema';
import { ageFromBirthDate, recommendLenses } from '@/lib/prescription/recommend';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'store_staff' || !me.storeId) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }
  // 자기 매장 픽업 주문 고객인지 확인
  const [link] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.customerId, params.id), eq(orders.pickupStoreId, me.storeId)))
    .limit(1);
  if (!link) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = recommendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다.' }, { status: 400 });
  }
  const [c] = await db
    .select({ birthDate: customers.birthDate })
    .from(customers)
    .where(eq(customers.id, params.id))
    .limit(1);
  const age = ageFromBirthDate(c?.birthDate);
  const recommendations = await recommendLenses(parsed.data.dose, parsed.data.lifestyle, age);
  return NextResponse.json({ recommendations, age });
}
