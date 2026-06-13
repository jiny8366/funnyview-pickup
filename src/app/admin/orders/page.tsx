import { PageHeader, PageWrap } from '@/components/admin/page-header';
import { requirePermissionOrRedirect } from '@/lib/auth/guards';
import { AdminOrdersClient } from '@/components/admin/admin-orders-client';

export const dynamic = 'force-dynamic';

export default async function AdminOrdersPage() {
  await requirePermissionOrRedirect('orders_read');
  return (
    <PageWrap>
      <PageHeader
        title="주문 관리"
        description="전체 주문을 상태별로 모니터링합니다. 단계별 처리는 픽업관리·가맹점 화면에서."
      />
      <AdminOrdersClient />
    </PageWrap>
  );
}
