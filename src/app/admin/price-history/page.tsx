import { notFound } from 'next/navigation';
import { PageHeader, PageWrap } from '@/components/admin/page-header';
import { PriceHistoryTable } from '@/components/admin/price-history-table';
import { getCurrentUser } from '@/lib/auth/current-user';
import { hasPermission } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

export default async function PriceHistoryPage() {
  const me = await getCurrentUser();
  if (!me) notFound();
  if (!me.isMaster && !hasPermission(me.permissions, 'price_history_view')) {
    notFound();
  }
  const canDelete = me.isMaster || hasPermission(me.permissions, 'price_history_delete');

  return (
    <PageWrap>
      <PageHeader
        title="가격변동이력"
        description="제품별 매입/공급/소비자 가격의 변경 이력. 미리보기로 PDF 출력, 엑셀(CSV) 로 다운로드 가능."
      />
      <PriceHistoryTable canDelete={canDelete} />
    </PageWrap>
  );
}
