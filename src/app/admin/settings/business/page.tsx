import { PageHeader, PageWrap } from '@/components/admin/page-header';
import { BusinessInfoForm } from '@/components/admin/business-info-form';
import { requirePermissionOrRedirect } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export default async function BusinessInfoSettingsPage() {
  await requirePermissionOrRedirect('settings_write');

  return (
    <PageWrap>
      <PageHeader
        title="사업장(회사) 정보"
        description="거래명세서·송장 발행자 및 푸터 사업자 표기의 단일 출처. 서비스명은 '퍼니뷰 예약시스템'으로 입력하면 명세서·송장에 그대로 표기되며, 저장 시 즉시 반영됩니다."
      />
      <BusinessInfoForm />
    </PageWrap>
  );
}
