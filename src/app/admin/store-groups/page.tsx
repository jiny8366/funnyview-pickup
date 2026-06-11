import { PageHeader, PageWrap } from '@/components/admin/page-header';
import { StoreGroupsManager } from '@/components/admin/store-groups-manager';
import { requirePermissionOrRedirect } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export default async function AdminStoreGroupsPage() {
  await requirePermissionOrRedirect('stores_write');

  return (
    <PageWrap>
      <PageHeader
        title="가맹점 그룹설정"
        description="픽업가맹점 그룹을 만들고 그룹 단위 운영 설정(수수료율)을 관리합니다. 가맹점 리스트에서 선택하여 그룹에 포함할 수 있습니다."
      />
      <StoreGroupsManager />
    </PageWrap>
  );
}
