import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { customers, users } from '@/db/schema';
import { effectivePermissions } from './permissions';
import { readSession } from './session';

export interface CurrentUser {
  id: string;
  role: 'customer' | 'warehouse_staff' | 'store_staff' | 'admin';
  phone: string | null;
  email: string | null;
  storeId: string | null;
  /** users.permissions 의 raw 값 (NULL 가능). 권한 편집 UI 에서 사용. */
  permissionsRaw: string[] | null;
  /** ROLE_DEFAULTS + override 가 합쳐진 실효 권한. 가드 체크용. */
  permissions: string[];
  customerId?: string;
  customerName?: string;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await readSession();
  if (!session) return null;

  const rows = await db
    .select({
      id: users.id,
      role: users.role,
      phone: users.phone,
      email: users.email,
      storeId: users.storeId,
      permissions: users.permissions,
    })
    .from(users)
    .where(eq(users.id, session.uid))
    .limit(1);

  const user = rows[0];
  if (!user) return null;

  let customerId: string | undefined;
  let customerName: string | undefined;
  if (user.role === 'customer') {
    const c = await db
      .select({ id: customers.id, name: customers.name })
      .from(customers)
      .where(eq(customers.userId, user.id))
      .limit(1);
    if (c[0]) {
      customerId = c[0].id;
      customerName = c[0].name;
    }
  }

  return {
    id: user.id,
    role: user.role,
    phone: user.phone,
    email: user.email,
    storeId: user.storeId,
    permissionsRaw: user.permissions,
    permissions: effectivePermissions(user.role, user.permissions),
    customerId,
    customerName,
  };
}
