import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/current-user';
import { StoreOrderHistoryClient } from './history-client';

export const dynamic = 'force-dynamic';

export default async function StoreOrderHistoryPage() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'store_staff' || !me.storeId) {
    redirect('/login/store');
  }
  return <StoreOrderHistoryClient />;
}
