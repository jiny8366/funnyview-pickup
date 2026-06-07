'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { HeaderMenu, type MenuSection } from '@/components/layout/header-menu';
import { CartButton } from './cart-button';
import { portalUrl } from '@/lib/portal-url';

interface MeUser {
  id: string;
  role: 'customer' | 'warehouse_staff' | 'store_staff' | 'admin';
  username: string | null;
  isMaster: boolean;
  permissions: string[];
}

const ADMIN_ITEMS = [
  { href: '/admin/dashboard',     label: '대시보드' },
  { href: '/admin/orders',        label: '주문 관리' },
  { href: '/admin/settlement',    label: '정산 / 매출' },
  { href: '/admin/staff',         label: '계정 관리' },
  { href: '/admin/customers',     label: '고객 관리' },
  { href: '/admin/products',      label: '제품 마스터' },
  { href: '/admin/categories',    label: '카테고리' },
  { href: '/admin/price-history', label: '가격 변동 이력' },
  { href: '/admin/stores',        label: '가맹점' },
  { href: '/admin/home',          label: '홈 섹션' },
];

const WAREHOUSE_ITEMS = [
  { href: '/warehouse',                label: '대시보드' },
  { href: '/warehouse/orders',         label: '주문 처리' },
  { href: '/warehouse/picklist',       label: '픽리스트' },
  { href: '/warehouse/shipments',      label: '출고 관리' },
  { href: '/warehouse/inventory',      label: '재고' },
  { href: '/warehouse/inbound',        label: '입고 (스캔)' },
  { href: '/warehouse/inbound/new',    label: '입고 (전표)' },
  { href: '/warehouse/inbound/history', label: '입고 이력' },
  { href: '/warehouse/returns',        label: '반품' },
];

const STORE_ITEMS = [
  { href: '/store',          label: '대시보드' },
  { href: '/store/incoming', label: '배송 중' },
  { href: '/store/pickup',   label: '픽업 처리' },
  { href: '/store/history',  label: '처리 이력' },
  { href: '/store/info',     label: '매장 정보' },
];

const CUSTOMER_ITEMS = [
  { href: '/customer',        label: '마이페이지' },
  { href: '/customer/order',  label: '주문하기' },
  { href: '/customer/orders', label: '내 주문' },
];

function externalize(items: { href: string; label: string }[], portal: 'admin' | 'staff' | 'store') {
  return items.map((it) => ({
    ...it,
    href: portalUrl(portal, it.href),
    external: true,
  }));
}

function buildSections(user: MeUser | null): MenuSection[] {
  const shop: MenuSection = {
    title: '쇼핑',
    items: [
      { href: '/products',       label: '렌즈 둘러보기' },
      { href: '/cart',           label: '장바구니' },
      { href: '/stores',         label: '매장 찾기' },
      { href: '/customer/order', label: '주문하기' },
    ],
  };

  if (!user) {
    return [
      shop,
      {
        title: '계정',
        items: [
          { href: '/login',    label: '로그인' },
          { href: '/register', label: '회원가입' },
        ],
      },
    ];
  }

  // 마스터/관리자 — 모든 portal 메뉴 전체 노출
  if (user.isMaster || user.role === 'admin') {
    return [
      shop,
      {
        title: '🛡 Portal 바로가기',
        items: [
          { href: portalUrl('admin', '/admin/dashboard'), label: '관리자 portal', external: true },
          { href: portalUrl('staff', '/warehouse'),       label: '픽업서비스 portal', external: true },
          { href: portalUrl('store', '/store'),           label: '픽업가맹점 portal', external: true },
        ],
      },
      { title: '내 계정 (고객)', items: CUSTOMER_ITEMS },
      { title: '관리자 메뉴',    items: externalize(ADMIN_ITEMS,     'admin') },
      { title: '픽업서비스 메뉴', items: externalize(WAREHOUSE_ITEMS, 'staff') },
      { title: '픽업가맹점 메뉴', items: externalize(STORE_ITEMS,     'store') },
    ];
  }

  // 픽업서비스 staff
  if (user.role === 'warehouse_staff') {
    return [
      shop,
      { title: '픽업서비스 메뉴', items: externalize(WAREHOUSE_ITEMS, 'staff') },
    ];
  }

  // 픽업가맹점 staff
  if (user.role === 'store_staff') {
    return [
      shop,
      { title: '픽업가맹점 메뉴', items: externalize(STORE_ITEMS, 'store') },
    ];
  }

  // 일반 고객
  return [
    shop,
    { title: '내 계정', items: CUSTOMER_ITEMS },
  ];
}

export function ShopHeaderNav() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : Promise.resolve({ user: null })))
      .then((j) => setUser(j.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoaded(true));
  }, []);

  const sections = buildSections(user);

  const userLabel = user
    ? user.isMaster
      ? '🛡 마스터'
      : user.role === 'admin'
        ? '관리자'
        : user.role === 'warehouse_staff'
          ? '픽업서비스'
          : user.role === 'store_staff'
            ? '픽업가맹점'
            : '고객'
    : undefined;

  const loggedOutFooter = (
    <Link
      href="/login"
      className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700"
    >
      로그인
    </Link>
  );

  return (
    <div className="flex items-center gap-1">
      <CartButton />
      <HeaderMenu
        sections={sections}
        user={loaded && user ? { label: userLabel ?? '', sub: user.username ?? undefined } : undefined}
        showNotifications={false}
        showPushToggle={false}
        showLogout={Boolean(user)}
        loggedOutFooter={loggedOutFooter}
        accent="gray"
      />
    </div>
  );
}
