'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PushToggle } from '@/components/pwa/push-toggle';
import { cn } from '@/lib/utils/cn';
import { NotificationBell } from './notification-bell';

export interface MenuItem {
  href: string;
  label: string;
  icon?: ReactNode;
  /** 이 항목 노출에 필요한 권한 슬러그. 없으면 항상 노출. */
  permission?: string;
  /** 외부 URL (다른 hostname). true 면 <a> 태그로 새 탐색 (same hostname 쿠키 분리). */
  external?: boolean;
}

export interface MenuSection {
  title?: string;
  items: MenuItem[];
}

/**
 * 우측 상단 햄버거(3줄) → 드롭다운 메뉴.
 * 모든 portal (admin/warehouse/store/customer) 공통.
 *
 * 데스크탑 + 모바일 동일 패턴. 클릭 외 영역 클릭 또는 ESC 시 닫힘.
 */
export function HeaderMenu({
  sections,
  user,
  userPermissions,
  showNotifications = true,
  showPushToggle = true,
  accent = 'gray',
}: {
  sections: MenuSection[];
  user?: { label: string; sub?: string };
  /**
   * 사용자의 실효 권한 슬러그 목록 (effectivePermissions 결과).
   * 항목의 permission 필드가 있고 이 배열에 없으면 메뉴에서 숨김.
   * undefined 면 권한 필터링 안 함 (모든 항목 노출).
   */
  userPermissions?: string[];
  showNotifications?: boolean;
  showPushToggle?: boolean;
  accent?: 'gray' | 'brand' | 'emerald' | 'amber' | 'red';
}) {
  const visibleSections = userPermissions
    ? sections
        .map((s) => ({
          ...s,
          items: s.items.filter(
            (it) => !it.permission || userPermissions.includes(it.permission),
          ),
        }))
        .filter((s) => s.items.length > 0)
    : sections;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // 경로 변경 시 자동 닫힘
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div ref={ref} className="relative flex items-center gap-1">
      {showNotifications && <NotificationBell />}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="메뉴 열기"
        aria-expanded={open}
        className="grid h-10 w-10 min-h-touch min-w-touch place-items-center rounded-lg text-gray-700 hover:bg-gray-100"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {open ? (
            <>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </>
          ) : (
            <>
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </>
          )}
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-72 origin-top-right overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl"
          role="menu"
        >
          {user && (
            <div className={cn('border-b border-gray-100 px-4 py-3', ACCENT_BG[accent])}>
              <div className="text-sm font-semibold text-gray-900">{user.label}</div>
              {user.sub && (
                <div className="mt-0.5 truncate font-mono text-xs text-gray-500">{user.sub}</div>
              )}
            </div>
          )}

          <div className="max-h-[60vh] overflow-y-auto py-1">
            {visibleSections.map((section, si) => (
              <div key={si} className={si > 0 ? 'mt-1 border-t border-gray-100 pt-1' : ''}>
                {section.title && (
                  <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    {section.title}
                  </div>
                )}
                <ul>
                  {section.items.map((it) => {
                    const active =
                      !it.external &&
                      (pathname === it.href ||
                        (it.href !== '/' && pathname?.startsWith(it.href + '/')));
                    const classes = cn(
                      'flex items-center gap-2.5 px-4 py-2 text-sm font-medium transition',
                      active
                        ? cn('text-gray-900', ACCENT_BG_ACTIVE[accent])
                        : 'text-gray-700 hover:bg-gray-50',
                    );
                    const inner = (
                      <>
                        {it.icon && (
                          <span
                            className={cn(
                              'shrink-0',
                              active ? ACCENT_TEXT[accent] : 'text-gray-400',
                            )}
                          >
                            {it.icon}
                          </span>
                        )}
                        <span className="truncate">{it.label}</span>
                      </>
                    );
                    return (
                      <li key={it.href}>
                        {it.external ? (
                          <a href={it.href} className={classes} role="menuitem">
                            {inner}
                          </a>
                        ) : (
                          <Link href={it.href} className={classes} role="menuitem">
                            {inner}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-gray-100 bg-gray-50 px-4 py-3">
            {showPushToggle ? <PushToggle /> : <span />}
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
              >
                로그아웃
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const ACCENT_BG: Record<string, string> = {
  gray: 'bg-gray-50',
  brand: 'bg-brand-50',
  emerald: 'bg-emerald-50',
  amber: 'bg-amber-50',
  red: 'bg-red-50',
};

const ACCENT_BG_ACTIVE: Record<string, string> = {
  gray: 'bg-gray-100',
  brand: 'bg-brand-50',
  emerald: 'bg-emerald-50',
  amber: 'bg-amber-50',
  red: 'bg-red-50',
};

const ACCENT_TEXT: Record<string, string> = {
  gray: 'text-gray-600',
  brand: 'text-brand-600',
  emerald: 'text-emerald-600',
  amber: 'text-amber-600',
  red: 'text-red-600',
};
