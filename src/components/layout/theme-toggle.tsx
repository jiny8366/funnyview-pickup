'use client';

import { useEffect, useState } from 'react';

/**
 * 운영 포털(관리자·픽업서비스·가맹점) 화면 모드(라이트/다크) 토글.
 * html.theme-dark 클래스 + localStorage('opsTheme') 로 영속. 고객 화면엔 미배치 → Light 고정 유지.
 * 무플래시 적용은 layout.tsx 의 인라인 스크립트가 담당.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('theme-dark'));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('theme-dark', next);
    try {
      localStorage.setItem('opsTheme', next ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="press grid h-9 w-9 place-items-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
      aria-label="화면 모드 전환 (라이트/다크)"
      title={dark ? '라이트 모드로' : '다크 모드로'}
    >
      <span className="text-base" aria-hidden>{dark ? '☀️' : '🌙'}</span>
    </button>
  );
}
