import Link from 'next/link';
import { HeaderMenu, type MenuSection } from './header-menu';

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
}: {
  role: Role;
  nav: { href: string; label: string }[];
  user?: { label: string; sub?: string };
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
        <Link href="/" className="flex items-baseline gap-1.5 truncate">
          <span className="truncate text-base font-semibold md:text-lg">
            Funnyview Pickup
          </span>
          <span className={labelClass}>· {meta.label}</span>
        </Link>

        <HeaderMenu
          sections={sections}
          user={user ?? { label: meta.label }}
          accent={meta.accent}
        />
      </div>
    </header>
  );
}
