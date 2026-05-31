import { CustomerBottomNav } from '@/components/layout/customer-bottom-nav';
import { RoleHeader } from '@/components/layout/role-header';

const NAV = [
  { href: '/', label: '홈' },
  { href: '/customer', label: '마이페이지' },
  { href: '/customer/order', label: '주문하기' },
  { href: '/customer/orders', label: '내 주문' },
  { href: '/customer/prescriptions', label: '도수 정보' },
] as const;

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <RoleHeader role="customer" nav={[...NAV]} />
      <main className="mx-auto max-w-6xl px-4 py-5 pb-24 md:px-6 md:py-8 md:pb-8">
        {children}
      </main>
      <CustomerBottomNav />
    </div>
  );
}
