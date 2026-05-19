import Link from 'next/link';
import { HeaderMenu, type MenuSection } from '@/components/layout/header-menu';
import {
  IconBox,
  IconCart,
  IconChart,
  IconLayout,
  IconSettings,
  IconStore,
  IconTag,
  IconUsers,
  IconWallet,
} from '@/components/ui/icons';

const SECTIONS: MenuSection[] = [
  {
    title: '운영',
    items: [
      { href: '/admin/dashboard', label: '대시보드', icon: <IconChart size={16} />, permission: 'dashboard_view' },
      { href: '/admin/orders', label: '주문 관리', icon: <IconCart size={16} />, permission: 'orders_read' },
      { href: '/admin/settlement', label: '정산 / 매출', icon: <IconWallet size={16} />, permission: 'settlement_read' },
      { href: '/admin/staff', label: '계정 관리', icon: <IconUsers size={16} />, permission: 'staff_read' },
    ],
  },
  {
    title: '상품',
    items: [
      { href: '/admin/products', label: '제품 마스터', icon: <IconBox size={16} />, permission: 'products_read' },
      { href: '/admin/categories', label: '카테고리', icon: <IconTag size={16} />, permission: 'categories_write' },
    ],
  },
  {
    title: '가맹점',
    items: [
      { href: '/admin/stores', label: '가맹점', icon: <IconStore size={16} />, permission: 'stores_read' },
    ],
  },
  {
    title: 'CMS · 마케팅',
    items: [
      { href: '/admin/home', label: '홈 섹션', icon: <IconLayout size={16} />, permission: 'home_sections_write' },
      { href: '/admin/home/analytics', label: '섹션 분석', icon: <IconChart size={16} />, permission: 'home_analytics_view' },
    ],
  },
  {
    title: '시스템',
    items: [
      { href: '/admin/settings', label: '설정', icon: <IconSettings size={16} />, permission: 'settings_write' },
    ],
  },
];

/**
 * 관리자 콘솔 — 모든 portal 과 일관된 햄버거 드롭다운 헤더.
 * (사이드바 제거 — 우측 상단 햄버거 통일)
 *
 * permissions prop 이 있으면 메뉴 자동 필터링 (admin role 의 권한 override 케이스).
 */
export function AdminShell({
  user,
  permissions,
  children,
}: {
  user?: { phone: string };
  permissions?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header
        className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 md:px-8 md:py-4">
          <Link href="/admin/dashboard" className="flex items-center gap-2 truncate">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gray-900 text-xs font-bold text-white">
              FV
            </span>
            <span className="truncate text-base font-semibold md:text-lg">
              Funnyview Pickup
              <span className="ml-1 hidden text-sm font-medium text-red-600 md:inline">· 관리자</span>
            </span>
          </Link>

          <HeaderMenu
            sections={SECTIONS}
            user={{ label: '관리자', sub: user?.phone ?? '' }}
            userPermissions={permissions}
            accent="red"
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-safe md:px-8 md:py-8">
        {children}
      </main>
    </div>
  );
}
