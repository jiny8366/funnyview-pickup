import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { stores } from '@/db/schema';
import { RoleHeader } from '@/components/layout/role-header';
import { getCurrentUser } from '@/lib/auth/current-user';

// 포털별 브라우저 탭 제목 — 호스트(링크)에 맞춰 표시 (JINY 지시)
export const metadata: Metadata = {
  title: { absolute: '픽업가맹점', template: '%s | 픽업가맹점' },
};

const NAV = [
  { href: '/store', label: '대시보드' },
  { href: '/store/order', label: '발주(주문)' },
  { href: '/store/order/history', label: '내 발주 내역' },
  { href: '/store/incoming', label: '배송 중' },
  { href: '/store/pickup', label: '픽업 처리' },
  { href: '/store/customers', label: '고객 관리' },
  { href: '/store/history', label: '처리 이력' },
  { href: '/store/info', label: '매장 정보' },
];

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getCurrentUser();
  // 계정 관리는 대표자(owner)에게만 노출 — 담당 안경사(optician)는 미노출
  const nav =
    me?.storeRole === 'owner' ? [...NAV, { href: '/store/accounts', label: '계정 관리' }] : NAV;

  // 헤더 '픽업가맹점' 옆 상호 표시 — 소속 매장명 조회 (관리자는 소속 없음 → 미표시)
  let storeName: string | undefined;
  if (me?.storeId) {
    const [s] = await db
      .select({ name: stores.name })
      .from(stores)
      .where(eq(stores.id, me.storeId))
      .limit(1);
    storeName = s?.name;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <RoleHeader role="store" nav={nav} storeName={storeName} />
      <main className="mx-auto max-w-6xl px-4 py-5 pb-safe md:px-6 md:py-8">{children}</main>
    </div>
  );
}
