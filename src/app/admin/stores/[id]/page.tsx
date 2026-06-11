import { requirePermissionOrRedirect } from '@/lib/auth/guards';
import { StoreEditForm } from '@/components/admin/store-edit-form';

export const dynamic = 'force-dynamic';

export default async function AdminStoreDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePermissionOrRedirect('stores_write');

  return <StoreEditForm storeId={params.id} />;
}
