import Link from 'next/link';
import Image from 'next/image';
import { HeaderMenu, type MenuSection } from './header-menu';
import { ThemeToggle } from './theme-toggle';

type Role = 'customer' | 'warehouse' | 'store';

const ROLE_META: Record<Role, { label: string; accent: 'brand' | 'emerald' | 'amber' }> = {
  customer: { label: '고객', accent: 'brand' },
  warehouse: { label: '픽업서비스 업체', accent: 'emerald' },
  store: { label: '픽업가맹점', accent: 'amber' },
};

/**
 * 역할별 공통 헤더 — 우측 상단 햄버거(3줄) → 드롭다운 메뉴 통일.
 * 데스크탑/모바일 동일 패턴.
 */
export function RoleHeader({
  role,
  nav,
  user,
  storeName,
}: {
  role: Role;
  nav: { href: string; label: string }[];
  user?: { label: string; sub?: string };
  /** 픽업가맹점 포털 — 역할 라벨 옆에 표시할 매장 상호(소속 매장 식별). */
  storeName?: string;
}) {
  const meta = ROLE_META[role];
  const sections: MenuSection[] = [{ items: nav }];

  const labelClass =
    meta.accent === 'brand'
      ? 'hidden text-sm font-medium md:inline text-brand-600'
      : meta.accent === 'emerald'
        ? 'hidden text-sm font-medium md:inline text-emerald-600'
        : 'hidden text-sm font-medium md:inline text-amber-600';

  return (
    <header
      className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 md:px-6 md:py-4">
        <Link href="/" className="flex items-center gap-1.5 truncate">
          <Image src="/brand/mark.png" alt="" width={28} height={28} priority className="h-7 w-7 shrink-0 object-contain" />
          <span className="truncate text-base font-semibold md:text-lg">
            퍼니뷰 예약시스템
          </span>
          <span className={labelClass}>· {meta.label}</span>
          {storeName && (
            <span className="truncate text-sm font-semibold text-amber-700">· {storeName}</span>
          )}
        </Link>

        <div className="flex items-center gap-2">
          {/* 운영 포털만 화면 모드(라이트/다크) 토글 — 고객은 Light 고정 */}
          {role !== 'customer' && <ThemeToggle />}
          <HeaderMenu
            sections={sections}
            user={user ?? { label: meta.label }}
            accent={meta.accent}
          />
        </div>
      </div>
    </header>
  );
}
