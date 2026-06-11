import { requirePermissionOrRedirect } from '@/lib/auth/guards';
import { StoreEditForm } from '@/components/admin/store-edit-form';
import { StoreProductCommissions } from '@/components/admin/store-product-commissions';
import { AccountsManager } from '@/components/accounts/accounts-manager';

export const dynamic = 'force-dynamic';

export default async function AdminStoreDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePermissionOrRedirect('stores_write');

  return (
    <div className="space-y-8">
      {/* 1) 기본/운영 정보 */}
      <StoreEditForm storeId={params.id} />

      {/* 2) 픽업가맹점 계정 관리 — 대표자/담당 안경사 아이디·비밀번호 */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">계정 관리 (대표자 · 담당 안경사)</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            대표자 로그인 계정과 담당 안경사 계정을 발급·관리합니다. 안경사는 본 매장 업무 권한만 가집니다.
          </p>
        </div>
        <AccountsManager endpoint={`/api/admin/stores/${params.id}/accounts`} listKey="accounts" canSetRole />
      </section>

      {/* 3) 제품별 수수료율 + 변경이력 */}
      <StoreProductCommissions storeId={params.id} />
    </div>
  );
}
