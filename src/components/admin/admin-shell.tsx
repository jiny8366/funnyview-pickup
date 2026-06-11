import Link from 'next/link';
import { HeaderMenu, type MenuSection } from '@/components/layout/header-menu';
import {
  IconBox,
  IconCart,
  IconChart,
  IconClipboard,
  IconHome,
  IconLayout,
  IconPlus,
  IconSettings,
  IconStore,
  IconTag,
  IconUser,
  IconUsers,
  IconWallet,
} from '@/components/ui/icons';
import { portalUrl } from '@/lib/portal';

const SECTIONS: MenuSection[] = [
  {
    title: '운영',
    items: [
      { href: '/admin/dashboard', label: '대시보드', icon: <IconChart size={16} />, permission: 'dashboard_view' },
      { href: '/admin/orders', label: '주문 관리', icon: <IconCart size={16} />, permission: 'orders_read' },
      { href: '/admin/urgent-purchases', label: '급매입 리스트', icon: <IconBox size={16} />, permission: 'orders_read' },
      { href: '/admin/settlement', label: '정산 / 매출', icon: <IconWallet size={16} />, permission: 'settlement_read' },
      { href: '/admin/staff', label: '계정 관리', icon: <IconUsers size={16} />, permission: 'staff_read' },
      { href: '/admin/customers', label: '고객 관리', icon: <IconUser size={16} />, permission: 'customers_read' },
    ],
  },
  {
    title: '상품',
    items: [
      { href: '/admin/products', label: '제품 마스터', icon: <IconBox size={16} />, permission: 'products_read' },
      { href: '/admin/suppliers', label: '매입처 관리', icon: <IconClipboard size={16} />, permission: 'settings_write' },
      { href: '/admin/categories', label: '카테고리', icon: <IconTag size={16} />, permission: 'categories_write' },
      { href: '/admin/price-history', label: '가격변동이력', icon: <IconChart size={16} />, permission: 'price_history_view' },
    ],
  },
  {
    title: '가맹점',
    items: [
      { href: '/admin/stores', label: '가맹점 목록', icon: <IconStore size={16} />, permission: 'stores_read' },
      { href: '/admin/stores/new', label: '가맹점 등록', icon: <IconPlus size={16} />, permission: 'stores_write' },
      { href: '/admin/store-groups', label: '가맹점 그룹설정', icon: <IconLayout size={16} />, permission: 'stores_write' },
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
 * isMaster + host 가 있으면 햄버거 최상단에 4 portal 바로가기 섹션 추가.
 */
export function AdminShell({
  user,
  permissions,
  isMaster,
  host,
  children,
}: {
  user?: { phone: string };
  permissions?: string[];
  isMaster?: boolean;
  host?: string;
  children: React.ReactNode;
}) {
  // 마스터 + host 가 있으면 4 portal 바로가기 섹션을 최상단에 prepend
  const sections: MenuSection[] =
    isMaster && host
      ? [
          {
            title: '🛡 Portal 바로가기 (마스터)',
            items: [
              {
                href: portalUrl('customer', host),
                label: '쇼핑몰 디자인 (고객)',
                icon: <IconHome size={16} />,
                external: true,
              },
              {
                href: portalUrl('admin', host),
                label: '관리자',
                icon: <IconSettings size={16} />,
                external: true,
              },
              {
                href: portalUrl('staff', host),
                label: '픽업담당자',
                icon: <IconCart size={16} />,
                external: true,
              },
              {
                href: portalUrl('store', host),
                label: '픽업가맹점',
                icon: <IconStore size={16} />,
                external: true,
              },
            ],
          },
          ...SECTIONS,
        ]
      : SECTIONS;

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
              퍼니뷰 예약시스템
              <span className="ml-1 hidden text-sm font-medium text-red-600 md:inline">· 관리자</span>
            </span>
          </Link>

          <HeaderMenu
            sections={sections}
            user={{ label: isMaster ? '🛡 마스터' : '관리자', sub: user?.phone ?? '' }}
            userPermissions={permissions}
            accent="red"
          />
        </div>
      </header>

      <main className="animate-fade-in mx-auto w-full max-w-6xl px-4 py-6 pb-safe md:px-8 md:py-8">
        {children}
      </main>
    </div>
  );
}
