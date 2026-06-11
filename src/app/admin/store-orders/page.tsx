import { PageHeader, PageWrap } from '@/components/admin/page-header';
import { requirePermissionOrRedirect } from '@/lib/auth/guards';
import { AdminStoreOrdersClient } from './store-orders-client';

export const dynamic = 'force-dynamic';

export default async function AdminStoreOrdersPage() {
  await requirePermissionOrRedirect('orders_read');

  return (
    <PageWrap>
      <PageHeader
        title="가맹점 발주"
        description="픽업가맹점이 본사로 발주한 콘택트렌즈 주문(공급가 기준)을 접수·확인·출고·완료 처리합니다."
      />
      <AdminStoreOrdersClient />
    </PageWrap>
  );
}
