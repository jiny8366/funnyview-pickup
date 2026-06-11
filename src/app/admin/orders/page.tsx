import Link from 'next/link';
import { PageHeader, PageWrap } from '@/components/admin/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { IconCart } from '@/components/ui/icons';
import { requirePermissionOrRedirect } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export default async function AdminOrdersPage() {
  await requirePermissionOrRedirect('orders_read');
  return (
    <PageWrap>
      <PageHeader
        title="주문 관리"
        description="전체 주문을 단계별로 모니터링합니다."
      />

      <EmptyState
        icon={<IconCart size={28} />}
        title="주문 통합 뷰는 다음 단계에서 활성화됩니다"
        description="현재는 픽업관리 화면(/warehouse/orders)과 가맹점 화면(/store/pickup)에서 단계별 주문을 처리할 수 있습니다."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/warehouse/orders"
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              📦 픽업서비스 주문 처리
            </Link>
            <Link
              href="/store/pickup"
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              🏪 가맹점 픽업 처리
            </Link>
          </div>
        }
      />
    </PageWrap>
  );
}
