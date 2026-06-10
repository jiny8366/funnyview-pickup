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

const CUSTOMER_ITEMS = [
  { href: '/customer',        label: '마이페이지' },
  { href: '/customer/order',  label: '주문하기' },
  { href: '/customer/orders', label: '내 주문' },
];

/**
 * 고객(쇼핑) 포털 햄버거. 이 포털의 '목적=쇼핑'에 충실하게 구성.
 * 운영자(마스터/관리자/픽업서비스/가맹점)는 운영 메뉴 트리를 여기 쏟지 않고
 * '콘솔로 이동' 링크만 노출 — 운영 메뉴는 각자 포털에서 본다(포털 간섭 방지).
 */
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

  // 마스터/관리자 — 쇼핑(디자인 검토용) + 운영 콘솔 '진입 링크'만(메뉴 트리는 각 포털에서)
  if (user.isMaster || user.role === 'admin') {
    return [
      shop,
      {
        title: '🛡 운영 콘솔',
        items: [
          { href: portalUrl('admin', '/admin/dashboard'), label: '관리자 콘솔', external: true },
          { href: portalUrl('staff', '/warehouse'),       label: '픽업서비스 콘솔', external: true },
          { href: portalUrl('store', '/store'),           label: '픽업가맹점 콘솔', external: true },
        ],
      },
    ];
  }

  // 픽업서비스 staff — 쇼핑 + 자기 콘솔로
  if (user.role === 'warehouse_staff') {
    return [
      shop,
      { title: '운영', items: [{ href: portalUrl('staff', '/warehouse'), label: '픽업서비스 콘솔로 →', external: true }] },
    ];
  }

  // 픽업가맹점 staff — 쇼핑 + 자기 콘솔로
  if (user.role === 'store_staff') {
    return [
      shop,
      { title: '운영', items: [{ href: portalUrl('store', '/store'), label: '픽업가맹점 콘솔로 →', external: true }] },
    ];
  }

  // 일반 고객 — 쇼핑 + 내 계정
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
