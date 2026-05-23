import Link from 'next/link';
import { SectionRenderer } from '@/components/home/section-renderer';
import { StaffPortalSwitcher } from '@/components/layout/staff-portal-switcher';
import { getCurrentUser } from '@/lib/auth/current-user';
import { loadActiveSections } from '@/lib/home/load-sections';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [sections, user] = await Promise.all([
    loadActiveSections().catch(() => []),
    getCurrentUser().catch(() => null),
  ]);

  const myPageHref =
    user?.role === 'customer'
      ? '/customer'
      : user?.role === 'warehouse_staff'
        ? '/warehouse'
        : user?.role === 'store_staff'
          ? '/store'
          : '/admin/dashboard';

  return (
    <main className="min-h-screen bg-white pb-safe">
      <header
        className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3 md:px-6">
          <Link href="/" className="truncate text-base font-bold tracking-tight md:text-lg">
            Funnyview Pickup
          </Link>
          <nav className="flex items-center gap-1.5 text-sm text-gray-600 md:gap-4">
            <Link href="/products" className="hidden font-medium text-gray-900 hover:text-brand-600 transition-colors md:inline">
              렌즈 쇼핑
            </Link>
            <Link href="/stores" className="hidden hover:text-gray-900 md:inline">
              매장찾기
            </Link>
            {user?.role === 'customer' && (
              <Link href="/customer/orders" className="hidden hover:text-gray-900 md:inline">
                내 주문
              </Link>
            )}
            {user ? (
              <Link
                href={myPageHref}
                className="inline-flex min-h-touch items-center rounded-full bg-brand-600 px-3 py-1.5 text-[11px] font-medium text-white md:text-xs"
              >
                마이페이지
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex min-h-touch items-center px-2 text-gray-500 hover:text-gray-900"
                >
                  로그인
                </Link>
                <Link
                  href="/register"
                  className="inline-flex min-h-touch items-center rounded-full bg-brand-600 px-3 py-1.5 text-[11px] font-medium text-white md:text-xs"
                >
                  가입
                </Link>
              </>
            )}
            <span className="ml-1 h-6 w-px bg-gray-200" aria-hidden />
            <StaffPortalSwitcher />
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-5 px-4 py-5 md:space-y-6 md:px-6 md:py-10">
        {sections.length === 0 ? (
          <EmptyHomeFallback />
        ) : (
          sections.map((s) => (
            <SectionRenderer key={s.id} section={s as Parameters<typeof SectionRenderer>[0]['section']} />
          ))
        )}
      </div>

      <footer className="border-t border-gray-200 py-8 text-center text-xs text-gray-400">
        Funnyview Pickup · 콘택트렌즈 픽업서비스
      </footer>
    </main>
  );
}

function EmptyHomeFallback() {
  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gray-900 px-8 py-16 text-white md:py-24">
        <div className="relative z-10 max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/50">
            Contact Lens Pickup Service
          </p>
          <h2 className="mt-3 text-4xl font-black leading-tight tracking-tight md:text-5xl">
            당신의 눈빛을<br />바꿔드립니다
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            아큐브, 알콘, 바슈롬 등 국내외 프리미엄 콘택트렌즈를<br className="hidden md:block" />
            가까운 가맹점에서 빠르게 픽업하세요.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/products"
              className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-100"
            >
              렌즈 둘러보기 →
            </Link>
            <Link
              href="/stores"
              className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              매장 찾기
            </Link>
          </div>
        </div>
        {/* Decorative circles */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand-600/20" />
        <div className="pointer-events-none absolute -bottom-20 right-24 h-96 w-96 rounded-full bg-brand-500/10" />
      </div>

      {/* Category quick links */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: '컬러렌즈', sub: '아름다운 눈빛', emoji: '✦', href: '/products?type=color', bg: 'bg-gray-800', text: 'text-white' },
          { label: '원데이', sub: '편리한 일회용', emoji: '○', href: '/products?type=1day', bg: 'bg-gray-50', text: 'text-gray-900' },
          { label: '난시용', sub: '토릭렌즈', emoji: '◎', href: '/products?type=toric', bg: 'bg-gray-50', text: 'text-gray-900' },
          { label: '다초점', sub: '노안 교정', emoji: '⊕', href: '/products?type=multifocal', bg: 'bg-gray-50', text: 'text-gray-900' },
        ].map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className={`${c.bg} ${c.text} group flex flex-col rounded-2xl px-5 py-6 transition hover:opacity-90`}
          >
            <span className="text-2xl">{c.emoji}</span>
            <span className="mt-4 text-lg font-bold">{c.label}</span>
            <span className={`mt-0.5 text-xs ${c.text === 'text-white' ? 'opacity-60' : 'text-gray-400'}`}>{c.sub}</span>
          </Link>
        ))}
      </div>

      <div className="rounded-3xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
        관리자가{' '}
        <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">/admin/home</code>
        {' '}에서 추가 섹션을 구성할 수 있습니다.
      </div>
    </div>
  );
}
