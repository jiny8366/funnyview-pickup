'use client';

import { useState } from 'react';
import { AdminSidebar } from './admin-sidebar';

export function AdminShell({
  user,
  children,
}: {
  user?: { phone: string };
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminSidebar
        user={user}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      <div className="md:pl-72">
        {/* 모바일 헤더 */}
        <header
          className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-gray-200 bg-white/95 px-4 backdrop-blur md:hidden"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-lg text-gray-700 hover:bg-gray-100"
            aria-label="메뉴 열기"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="text-sm font-semibold text-gray-900">관리자 콘솔</div>
          <span className="w-10" />
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-safe md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
