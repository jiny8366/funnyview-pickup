import Link from 'next/link';
import { desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { stores, storeGroups } from '@/db/schema';
import { PageHeader, PageWrap } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { IconPlus, IconStore } from '@/components/ui/icons';
import { requirePermissionOrRedirect } from '@/lib/auth/guards';
import { StoresTable } from '@/components/admin/stores-table';

export const dynamic = 'force-dynamic';

export default async function AdminStoresPage() {
  await requirePermissionOrRedirect('stores_read');
  const rows = await db
    .select({
      id: stores.id,
      name: stores.name,
      addressLine1: stores.addressLine1,
      phone: stores.phone,
      commissionRate: stores.commissionRate,
      isActive: stores.isActive,
      groupName: storeGroups.name,
    })
    .from(stores)
    .leftJoin(storeGroups, eq(storeGroups.id, stores.groupId))
    .where(isNull(stores.deletedAt))
    .orderBy(desc(stores.createdAt));

  return (
    <PageWrap>
      <PageHeader
        title="픽업가맹점"
        description="픽업 서비스 가맹점을 등록하고 운영 정보를 관리합니다."
        actions={
          <Link href="/admin/stores/new">
            <Button className="gap-1.5">
              <IconPlus size={16} /> 가맹점 추가
            </Button>
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<IconStore size={28} />}
          title="등록된 가맹점이 없습니다"
          description="첫 픽업가맹점을 등록하면 고객 주문이 해당 매장으로 라우팅됩니다."
        />
      ) : (
        <StoresTable rows={rows} />
      )}
    </PageWrap>
  );
}
