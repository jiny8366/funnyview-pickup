import { RoleHeader } from '@/components/layout/role-header';
import { getCurrentUser } from '@/lib/auth/current-user';

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
  return (
    <div className="min-h-screen bg-gray-50">
      <RoleHeader role="store" nav={nav} />
      <main className="mx-auto max-w-6xl px-4 py-5 pb-safe md:px-6 md:py-8">{children}</main>
    </div>
  );
}
