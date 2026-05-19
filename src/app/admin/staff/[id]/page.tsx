import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { stores, users } from '@/db/schema';
import { PageHeader, PageWrap } from '@/components/admin/page-header';
import { StaffForm } from '@/components/admin/staff-form';
import { StaffDeleteButton } from '@/components/admin/staff-delete-button';
import { getCurrentUser } from '@/lib/auth/current-user';
import { isMasterUser } from '@/lib/auth/permissions';
import { IconArrowLeft } from '@/components/ui/icons';

export const dynamic = 'force-dynamic';

type StaffRole = 'admin' | 'warehouse_staff' | 'store_staff';

export default async function EditStaffPage({
  params,
}: {
  params: { id: string };
}) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') {
    notFound();
  }

  const [target] = await db
    .select({
      id: users.id,
      role: users.role,
      email: users.email,
      username: users.username,
      phone: users.phone,
      storeId: users.storeId,
      isActive: users.isActive,
      permissions: users.permissions,
    })
    .from(users)
    .where(and(eq(users.id, params.id), isNull(users.deletedAt)))
    .limit(1);

  if (!target) {
    notFound();
  }
  if (!['admin', 'warehouse_staff', 'store_staff'].includes(target.role)) {
    notFound();
  }
  // 마스터 대상이면 본인만 접근 (정보 갱신용). 다른 admin 은 직접 URL 입력해도 차단.
  if (isMasterUser(target.username, target.phone) && me.id !== target.id) {
    notFound();
  }

  const storeRows = await db
    .select({ id: stores.id, name: stores.name })
    .from(stores)
    .where(and(eq(stores.isActive, true), isNull(stores.deletedAt)))
    .orderBy(asc(stores.sortOrder), asc(stores.name));

  const isSelf = me.id === target.id;
  const targetIsMaster = isMasterUser(target.username, target.phone);

  return (
    <PageWrap>
      <PageHeader
        title={targetIsMaster ? '계정 편집 (마스터)' : '계정 편집'}
        description={target.email ?? target.username ?? '—'}
        actions={
          <div className="flex items-center gap-2">
            <StaffDeleteButton id={target.id} isSelf={isSelf} isMaster={targetIsMaster} />
            <Link
              href="/admin/staff"
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              <IconArrowLeft size={16} /> 목록으로
            </Link>
          </div>
        }
      />
      <StaffForm
        mode="edit"
        stores={storeRows}
        currentUserId={me.id}
        initial={{
          id: target.id,
          role: target.role as StaffRole,
          email: target.email ?? target.username ?? '',
          phone: target.phone ?? '',
          storeId: target.storeId,
          isActive: target.isActive,
          permissions: target.permissions,
          isMaster: targetIsMaster,
        }}
      />
    </PageWrap>
  );
}
