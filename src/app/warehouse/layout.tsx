import type { Metadata } from 'next';
import { RoleHeader } from '@/components/layout/role-header';

// 포털별 브라우저 탭 제목 — 호스트(링크)에 맞춰 표시 (JINY 지시)
export const metadata: Metadata = {
  title: { absolute: '픽업관리', template: '%s | 픽업관리' },
};

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
      <main className="animate-fade-in mx-auto max-w-6xl px-4 py-5 pb-safe md:px-6 md:py-8">{children}</main>
    </div>
  );
}
