import { RoleHeader } from '@/components/layout/role-header';

const NAV = [
  { href: '/warehouse', label: '대시보드' },
  { href: '/warehouse/orders', label: '주문 처리' },
  { href: '/warehouse/picklist', label: '픽리스트' },
  { href: '/warehouse/shipments', label: '출고 관리' },
  { href: '/warehouse/inventory', label: '재고' },
  { href: '/warehouse/inbound', label: '입고(스캔)' },
  { href: '/warehouse/inbound/new', label: '입고(전표)' },
  { href: '/warehouse/inbound/history', label: '입고이력' },
  { href: '/warehouse/returns', label: '반품' },
] as const;

export default function WarehouseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <RoleHeader role="warehouse" nav={[...NAV]} />
      <main className="mx-auto max-w-6xl px-4 py-5 pb-safe md:px-6 md:py-8">{children}</main>
    </div>
  );
}
