'use client';

import { useEffect, useRef, useState } from 'react';
import { portalUrl } from '@/lib/portal-url';

interface PortalOption {
  kind: 'admin' | 'staff' | 'store';
  label: string;
  path: string;
  emoji: string;
  color: string;
}

const PORTALS: PortalOption[] = [
  {
    kind: 'admin',
    label: '관리자',
    path: '/login/admin',
    emoji: '🛠️',
    color: 'text-red-700',
  },
  {
    kind: 'staff',
    label: '픽업스탭',
    path: '/login/warehouse',
    emoji: '📦',
    color: 'text-emerald-700',
  },
  {
    kind: 'store',
    label: '픽업가맹점',
    path: '/login/store',
    emoji: '🏪',
    color: 'text-amber-700',
  },
];

/**
 * 메인 (고객) 화면 우측 상단 — 직원 portal 진입 박스.
 * 빨간 사각형 클릭 시 3개 portal 선택 드롭다운.
 */
export function StaffPortalSwitcher() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

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

  function go(opt: PortalOption) {
    const url = portalUrl(opt.kind, opt.path);
    window.location.href = url;
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="직원 로그인"
        aria-expanded={open}
        className="grid h-9 w-9 place-items-center rounded-md bg-red-600 text-white shadow-sm transition hover:bg-red-700"
        title="직원 로그인 (관리자 / 픽업스탭 / 픽업가맹점)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 origin-top-right animate-scale-in overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-pop"
          role="menu"
        >
          <div className="border-b border-gray-100 bg-red-50 px-4 py-2.5">
            <div className="text-xs font-semibold text-red-700">직원 로그인</div>
            <div className="mt-0.5 text-[11px] text-red-600">portal 선택</div>
          </div>
          <ul className="py-1">
            {PORTALS.map((p) => (
              <li key={p.kind}>
                <button
                  type="button"
                  onClick={() => go(p)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
                  role="menuitem"
                >
                  <span className="text-lg">{p.emoji}</span>
                  <span className={p.color}>{p.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
