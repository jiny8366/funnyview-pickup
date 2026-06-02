'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export interface DrawerSection {
  title?: string;
  items: { href: string; label: string }[];
}

/**
 * 홈 전용 우측 슬라이드인 드로어 (방안B — lenslink 스타일).
 * 공용 HeaderMenu(드롭다운)와 별개로 홈에서만 사용. 다른 포털 영향 없음.
 * 기능/구조 중심, 비주얼 디테일은 M1 #3 디자인 패스에서 보강.
 */
export function HomeMenuDrawer({
  open,
  onClose,
  sections,
  user,
  loggedOutFooter,
}: {
  open: boolean;
  onClose: () => void;
  sections: DrawerSection[];
  user?: { label: string; sub?: string };
  loggedOutFooter?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <div
      className={`fixed inset-0 z-[60] ${open ? '' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      {/* 오버레이 */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      {/* 우측 패널 */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="메뉴"
        className={`absolute right-0 top-0 flex h-full w-80 max-w-[85vw] flex-col bg-white shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <span className="text-base font-black tracking-tight">메뉴</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="메뉴 닫기"
            className="grid h-9 w-9 place-items-center rounded-full text-gray-500 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        {user && (
          <div className="border-b border-gray-100 bg-brand-50 px-5 py-3">
            <div className="text-sm font-semibold text-gray-900">{user.label}</div>
            {user.sub && <div className="mt-0.5 truncate font-mono text-xs text-gray-500">{user.sub}</div>}
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {sections.map((section, si) => (
            <div key={si} className="mb-2">
              {section.title && (
                <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                  {section.title}
                </p>
              )}
              {section.items.map((it) => (
                <Link
                  key={it.href + it.label}
                  href={it.href}
                  onClick={onClose}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-brand-700"
                >
                  {it.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {loggedOutFooter && (
          <div className="border-t border-gray-100 px-5 py-4">{loggedOutFooter}</div>
        )}
      </aside>
    </div>
  );
}
