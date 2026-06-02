'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export interface DrawerSection {
  title?: string;
  items: { href: string; label: string; sub?: string; icon?: React.ReactNode }[];
}

// Apple 시그니처 이징 — 부드럽게 빠지는 감속 곡선
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

/**
 * 홈 전용 우측 슬라이드인 드로어 (방안B — lenslink 형태 + Apple 모션).
 * 공용 HeaderMenu(드롭다운)와 별개로 홈에서만 사용. 다른 포털 영향 없음.
 * backdrop blur · Apple 이징 슬라이드 · 항목 스태거 등장.
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
  // 포털 — 헤더의 backdrop-blur(containing block)를 벗어나 body 에 렌더해야
  // fixed inset-0 가 뷰포트 전체로 잡혀 드로어가 잘리지 않는다.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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

  // 항목별 스태거 지연 계산용 누적 인덱스
  let itemIndex = 0;

  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[60] ${open ? '' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      {/* 오버레이 — blur + fade */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/20 backdrop-blur-lg ${open ? 'opacity-100' : 'opacity-0'}`}
        style={{ transition: `opacity 500ms ${EASE}` }}
      />

      {/* 우측 패널 — Apple 이징 슬라이드 */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="메뉴"
        className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col border-l border-black/5 bg-white/90 shadow-2xl backdrop-blur-2xl"
        style={{
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: `transform 520ms ${EASE}`,
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <div className="flex items-center justify-between px-6 pb-3 pt-5">
          <span className="text-lg font-semibold tracking-tight text-gray-900">메뉴</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="메뉴 닫기"
            className="grid h-9 w-9 place-items-center rounded-full text-gray-500 transition hover:bg-gray-100 active:scale-90"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {user && (
          <div
            className="mx-4 mb-1 rounded-2xl bg-brand-50 px-4 py-3"
            style={{
              opacity: open ? 1 : 0,
              transform: open ? 'translateX(0)' : 'translateX(12px)',
              transition: `opacity 420ms ${EASE} 80ms, transform 420ms ${EASE} 80ms`,
            }}
          >
            <div className="text-sm font-semibold text-gray-900">{user.label}</div>
            {user.sub && <div className="mt-0.5 truncate font-mono text-xs text-gray-500">{user.sub}</div>}
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-3 pb-6">
          {sections.map((section, si) => (
            <div key={si} className="mb-2">
              {section.title && (
                <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  {section.title}
                </p>
              )}
              {section.items.map((it) => {
                const delay = open ? 120 + itemIndex * 32 : 0;
                itemIndex += 1;
                return (
                  <Link
                    key={it.href + it.label}
                    href={it.href}
                    onClick={onClose}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium text-gray-800 hover:bg-gray-100 hover:text-brand-700"
                    style={{
                      opacity: open ? 1 : 0,
                      transform: open ? 'translateX(0)' : 'translateX(12px)',
                      transition: `opacity 420ms ${EASE} ${delay}ms, transform 420ms ${EASE} ${delay}ms, background-color 150ms ease, color 150ms ease`,
                    }}
                  >
                    {it.icon && <span className="shrink-0 text-gray-400">{it.icon}</span>}
                    <span className="flex-1 truncate">{it.label}</span>
                    {it.sub && (
                      <span className="shrink-0 text-[11px] font-semibold tracking-wide text-gray-400">
                        {it.sub}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {loggedOutFooter && (
          <div className="border-t border-gray-100 px-6 py-4">{loggedOutFooter}</div>
        )}
      </aside>
    </div>,
    document.body,
  );
}
