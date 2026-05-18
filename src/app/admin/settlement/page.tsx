import Link from 'next/link';
import { PageHeader, PageWrap } from '@/components/admin/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { IconChart, IconWallet } from '@/components/ui/icons';

export const dynamic = 'force-dynamic';

export default function AdminSettlementPage() {
  return (
    <PageWrap>
      <PageHeader
        title="정산 / 매출"
        description="가맹점별 정산 내역과 매출/영업이익 리포트를 확인합니다."
      />

      <EmptyState
        icon={<IconWallet size={28} />}
        title="아직 정산할 주문이 없습니다"
        description="주문이 '처리완료' 상태가 되면 v_sales_daily / v_store_settlement 뷰를 통해 자동 집계됩니다."
        action={
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <IconChart size={16} /> 대시보드 보기
          </Link>
        }
      />
    </PageWrap>
  );
}
