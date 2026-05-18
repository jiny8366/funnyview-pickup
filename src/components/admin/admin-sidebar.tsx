'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import {
  IconBox,
  IconCart,
  IconChart,
  IconClose,
  IconHome,
  IconLayout,
  IconSettings,
  IconStore,
  IconTag,
  IconUsers,
  IconWallet,
} from '@/components/ui/icons';
import { cn } from '@/lib/utils/cn';

type NavSection = {
  title: string;
  items: { href: string; label: string; icon: ReactNode }[];
};

const NAV: NavSection[] = [
  {
    title: '운영',
    items: [
      { href: '/admin/dashboard', label: '대시보드', icon: <IconChart size={18} /> },
      { href: '/admin/orders', label: '주문 관리', icon: <IconCart size={18} /> },
      { href: '/admin/settlement', label: '정산 / 매출', icon: <IconWallet size={18} /> },
    ],
  },
  {
    title: '상품',
    items: [
      { href: '/admin/products', label: '제품 마스터', icon: <IconBox size={18} /> },
      { href: '/admin/categories', label: '카테고리', icon: <IconTag size={18} /> },
    ],
  },
  {
    title: '가맹점 · 직원',
    items: [
      { href: '/admin/stores', label: '가맹점', icon: <IconStore size={18} /> },
      { href: '/admin/staff', label: '직원', icon: <IconUsers size={18} /> },
    ],
  },
  {
    title: 'CMS · 마케팅',
    items: [
      { href: '/admin/home', label: '홈 섹션', icon: <IconLayout size={18} /> },
      { href: '/admin/home/analytics', label: '섹션 분석', icon: <IconChart size={18} /> },
    ],
  },
  {
    title: '시스템',
    items: [
      { href: '/admin/settings', label: '설정', icon: <IconSettings size={18} /> },
    ],
  },
];

export function AdminSidebar({
  user,
  mobileOpen,
  onClose,
}: {
  user?: { phone: string };
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* 모바일 backdrop */}
      {mobileOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          aria-hidden
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-gray-200 bg-white transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex h-16 items-center justify-between border-b border-gray-100 px-5">
          <Link href="/admin/dashboard" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              FV
            </span>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">Funnyview</div>
              <div className="text-[11px] text-gray-500">관리자 콘솔</div>
            </div>
          </Link>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 md:hidden"
              aria-label="닫기"
            >
              <IconClose size={18} />
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV.map((section) => (
            <div key={section.title} className="mb-5">
              <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                {section.title}
              </div>
              <ul className="space-y-0.5">
                {section.items.map((it) => {
                  const active =
                    pathname === it.href ||
                    (it.href !== '/admin' && pathname.startsWith(it.href + '/'));
                  return (
                    <li key={it.href}>
                      <Link
                        href={it.href}
                        onClick={onClose}
                        className={cn(
                          'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition',
                          active
                            ? 'bg-brand-50 text-brand-700'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900',
                        )}
                      >
                        <span className={cn(active ? 'text-brand-600' : 'text-gray-400')}>
                          {it.icon}
                        </span>
                        {it.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate">
              <div className="font-medium text-gray-700">관리자</div>
              <div className="truncate">{user?.phone ?? ''}</div>
            </div>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="rounded-md border border-gray-200 px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-50"
              >
                로그아웃
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
