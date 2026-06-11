import { PageHeader, PageWrap } from '@/components/admin/page-header';
import { SuppliersManager } from '@/components/admin/suppliers-manager';
import { requirePermissionOrRedirect } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export default async function AdminSuppliersPage() {
  await requirePermissionOrRedirect('settings_write');

  return (
    <PageWrap>
      <PageHeader
        title="매입처 관리"
        description="입고 전표에서 선택하는 매입처(공급사)를 등록·관리합니다. 비활성화하면 드롭다운에서 숨겨집니다."
      />
      <SuppliersManager />
    </PageWrap>
  );
}
