import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { customers, users } from '@/db/schema';

/**
 * 로그인 사용자의 customer 레코드 id 조회 (없으면 null). 읽기 경로용.
 */
export async function findCustomerIdForUser(userId: string): Promise<string | null> {
  const rows = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.userId, userId))
    .limit(1);
  return rows[0]?.id ?? null;
}

/**
 * 로그인 사용자의 customer 레코드를 보장하고 id 반환.
 * 없으면 users 정보로 생성 (admin/마스터로 고객 기능을 테스트하는 경우 포함).
 */
export async function ensureCustomerForUser(userId: string): Promise<string> {
  const existing = await findCustomerIdForUser(userId);
  if (existing) return existing;

  const [u] = await db
    .select({
      username: users.username,
      phone: users.phone,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const name = u?.username || u?.email?.split('@')[0] || '고객';
  const phone = u?.phone || '';

  const [created] = await db
    .insert(customers)
    .values({ userId, name, phone })
    .returning({ id: customers.id });
  return created.id;
}
