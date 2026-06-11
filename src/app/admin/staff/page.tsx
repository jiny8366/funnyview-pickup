import Link from 'next/link';
import { and, asc, desc, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { storeGroups, stores, users } from '@/db/schema';
import { PageHeader, PageWrap } from '@/components/admin/page-header';
import { StaffAccountsTable, type AccountRow } from '@/components/admin/staff-accounts-table';
import { IconPlus } from '@/components/ui/icons';
import { isMasterUser } from '@/lib/auth/permissions';
import { requirePermissionOrRedirect } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

/** 계정 관리 — 어드민/픽업업체/픽업가맹점 드롭다운 + (가맹점) 그룹·상호 검색. */
export default async function AdminStaffPage() {
  await requirePermissionOrRedirect('staff_read');

  const [rawRows, storeRows, groupRows] = await Promise.all([
    db
      .select({
        id: users.id,
        username: users.username,
        phone: users.phone,
        email: users.email,
        role: users.role,
        storeRole: users.storeRole,
        storeId: users.storeId,
        isActive: users.isActive,
      })
      .from(users)
      // 삭제(deletedAt)된 계정은 목록에서 제외
      .where(
        and(
          inArray(users.role, ['admin', 'warehouse_staff', 'store_staff']),
          isNull(users.deletedAt),
        ),
      )
      .orderBy(desc(users.createdAt)),
    db.select({ id: stores.id, name: stores.name, groupId: stores.groupId }).from(stores),
    db.select({ id: storeGroups.id, name: storeGroups.name }).from(storeGroups).orderBy(asc(storeGroups.name)),
  ]);

  const storeMap = new Map(storeRows.map((s) => [s.id, s]));
  const rows: AccountRow[] = rawRows
    .filter((r) => !isMasterUser(r.username, r.phone)) // 마스터는 관리 대상 아님(숨김)
    .map((r) => {
      const store = r.storeId ? storeMap.get(r.storeId) : undefined;
      return {
        id: r.id,
        username: r.username,
        phone: r.phone,
        email: r.email,
        role: r.role,
        storeRole: r.storeRole,
        storeId: r.storeId,
        storeName: store?.name ?? null,
        storeGroupId: store?.groupId ?? null,
        isActive: r.isActive,
        isMaster: false,
      };
    });

  return (
    <PageWrap>
      <PageHeader
        title="계정 관리"
        description="어드민 · 픽업업체 · 픽업가맹점 계정을 구분 선택하여 관리합니다."
        actions={
          <Link
            href="/admin/staff/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black"
          >
            <IconPlus size={16} /> 계정 등록
          </Link>
        }
      />
      <StaffAccountsTable rows={rows} groups={groupRows} />
    </PageWrap>
  );
}
