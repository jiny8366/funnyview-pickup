import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/current-user';
import { StoreOrderClient } from './order-client';

export const dynamic = 'force-dynamic';

/**
 * 가맹점 발주(주문) — 본사(퍼니뷰)로 콘택트렌즈를 발주.
 * 표시 가격은 **공급가(supply price)** 이며 소비자가와 완전 분리.
 */
export default async function StoreOrderPage() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'store_staff' || !me.storeId) {
    redirect('/login/store');
  }
  return <StoreOrderClient />;
}
