import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/current-user';
import { AccountsManager } from '@/components/accounts/accounts-manager';

export const dynamic = 'force-dynamic';

/** 가맹점 대표자(owner) 전용 — 담당 안경사 계정 관리. 안경사(optician)는 접근 불가. */
export default async function StoreAccountsPage() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'store_staff') redirect('/login/store');
  if (me.storeRole !== 'owner') redirect('/store'); // 담당 안경사는 계정관리 권한 없음

  return (
    <div className="animate-fade-in space-y-4">
      <header>
        <h1 className="text-xl font-bold md:text-2xl">계정 관리</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          담당 안경사 계정을 등록·관리합니다. 안경사는 본 매장의 픽업·검수 업무만 가능하며 계정 관리는 대표자만 할 수 있습니다.
        </p>
      </header>
      <AccountsManager endpoint="/api/store/accounts" listKey="opticians" />
    </div>
  );
}
