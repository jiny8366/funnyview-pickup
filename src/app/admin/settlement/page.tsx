import { PageHeader, PageWrap } from '@/components/admin/page-header';
import { requirePermissionOrRedirect } from '@/lib/auth/guards';
import { SettlementClient } from '@/components/admin/settlement-client';

export const dynamic = 'force-dynamic';

export default async function AdminSettlementPage() {
  await requirePermissionOrRedirect('settlement_read');
  return (
    <PageWrap>
      <PageHeader
        title="정산 / 매출"
        description="기간별 매출·원가·영업이익과 가맹점별 정산(순매출·수수료) 리포트를 확인합니다."
      />
      <SettlementClient />
    </PageWrap>
  );
}
