import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { customers } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { recommendSchema } from '@/lib/prescription/schema';
import { ageFromBirthDate, recommendLenses } from '@/lib/prescription/recommend';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me?.customerId) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = recommendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다.' }, { status: 400 });
  }
  const [c] = await db
    .select({ birthDate: customers.birthDate })
    .from(customers)
    .where(eq(customers.id, me.customerId))
    .limit(1);
  const age = ageFromBirthDate(c?.birthDate);
  const recommendations = await recommendLenses(parsed.data.dose, parsed.data.lifestyle, age);
  return NextResponse.json({ recommendations, age });
}
