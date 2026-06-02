'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { HomeMenuDrawer, type DrawerSection } from '@/components/home/home-menu-drawer';

interface MeUser {
  id: string;
  role: 'customer' | 'warehouse_staff' | 'store_staff' | 'admin';
  username: string | null;
  isMaster: boolean;
}

// 카테고리 — /products?type= (products 페이지가 type 파라미터를 읽어 필터)
const CATEGORY_ITEMS = [
  { href: '/products', label: '전체 렌즈' },
  { href: '/products?type=1day', label: '원데이' },
  { href: '/products?type=toric', label: '난시용' },
  { href: '/products?type=multifocal', label: '다초점' },
  { href: '/products?type=color', label: '컬러렌즈' },
];

// 브랜드 — /products?brand= (DB brand 값과 일치하는 한글 라벨)
const BRAND_ITEMS = [
  { href: '/products?brand=아큐브', label: '아큐브' },
  { href: '/products?brand=바슈롬', label: '바슈롬' },
  { href: '/products?brand=알콘', label: '알콘' },
  { href: '/products?brand=클라렌', label: '클라렌' },
  { href: '/products?brand=쿠퍼비전', label: '쿠퍼비전' },
  { href: '/products?brand=클라렌O2O2', label: '클라렌 O2O2' },
];

function buildSections(user: MeUser | null): DrawerSection[] {
  const base: DrawerSection[] = [
    { title: '카테고리', items: CATEGORY_ITEMS },
    { title: '브랜드', items: BRAND_ITEMS },
    { title: '픽업', items: [{ href: '/stores', label: '매장 찾기' }] },
  ];

  if (!user) {
    return [
      ...base,
      {
        title: '계정',
        items: [
          { href: '/login', label: '로그인' },
          { href: '/register', label: '회원가입' },
        ],
      },
    ];
  }

  return [
    ...base,
    {
      title: '내 계정',
      items: [
        { href: '/customer', label: '마이페이지' },
        { href: '/customer/order', label: '주문하기' },
        { href: '/customer/orders', label: '내 주문' },
      ],
    },
  ];
}

export function HomeHeaderNav() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);

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
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="메뉴 열기"
        aria-expanded={open}
        className="grid h-9 w-9 place-items-center rounded-lg text-gray-700 transition hover:bg-gray-100 active:scale-90"
      >
        <span className="space-y-[5px]">
          <span className="block h-0.5 w-5 rounded-full bg-current" />
          <span className="block h-0.5 w-5 rounded-full bg-current" />
          <span className="block h-0.5 w-5 rounded-full bg-current" />
        </span>
      </button>
      <HomeMenuDrawer
        open={open}
        onClose={() => setOpen(false)}
        sections={sections}
        user={loaded && user ? { label: userLabel ?? '', sub: user.username ?? undefined } : undefined}
        loggedOutFooter={!user ? loggedOutFooter : undefined}
      />
    </>
  );
}
