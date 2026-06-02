import Link from 'next/link';
import { HomeHeaderNav } from '@/components/home/home-header-nav';
import { ProductCarousel } from '@/components/home/product-carousel';
import { ReviewSection } from '@/components/home/review-section';
import { SectionRenderer } from '@/components/home/section-renderer';
import { TrendingKeywords } from '@/components/home/trending-keywords';
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
            <StaffPortalSwitcher />
            <span className="ml-1 h-6 w-px bg-gray-200" aria-hidden />
            <HomeHeaderNav />
          </nav>
        </div>
      </header>

      {/* 관리자 CMS 프로모션 섹션 (있을 때 최상단) */}
      {sections.length > 0 && (
        <div className="mx-auto max-w-5xl space-y-5 px-4 pt-5 md:space-y-6 md:px-6 md:pt-8">
          {sections.map((s) => (
            <SectionRenderer key={s.id} section={s as Parameters<typeof SectionRenderer>[0]['section']} />
          ))}
        </div>
      )}

      <div className="mx-auto max-w-5xl space-y-10 px-4 py-6 md:space-y-16 md:px-6 md:py-10">
        <Hero />
        <BrandShowcase />
        <ProductCarousel title="베스트셀러" subtitle="지금 많이 찾는 렌즈" />
        <Categories />
        <TrendingKeywords />
        <PickupProcess />
        <ReviewSection />
        <BottomCta />
      </div>

      <footer className="border-t border-gray-200 py-8 text-center text-xs text-gray-400">
        Funnyview Pickup · 콘택트렌즈 픽업서비스
      </footer>
    </main>
  );
}

/* ───────────────────────── Hero ───────────────────────── */
function Hero() {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gray-900 px-7 py-14 text-white md:px-12 md:py-24">
      <div className="relative z-10 max-w-xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
          Premium Contact Lens · Pickup Service
        </p>
        <h1 className="mt-3 text-[2.1rem] font-black leading-[1.12] tracking-tight md:text-6xl">
          정품 렌즈를<br />가까운 매장에서 픽업
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-white/70 md:text-base">
          아큐브 · 알콘 · 쿠퍼비전 · 바슈롬 등 국내외 제조사 정품을<br className="hidden md:block" />
          온라인으로 주문하고, 가까운 안경원에서 안경사 상담 후 받으세요.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
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
            가까운 매장 찾기
          </Link>
        </div>
      </div>
      <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand-600/30 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-24 right-16 h-96 w-96 rounded-full bg-brand-500/10 blur-3xl" />
    </section>
  );
}

/* ──────────────────── 제조사(브랜드) 쇼케이스 ──────────────────── */
/** 취급 제조사 — 마케팅 카피/액센트. 추후 제조사 공식 자산(로고·히어로·스토리)으로 교체 예정. */
const BRANDS: { ko: string; en: string; accent: string; tagline: string }[] = [
  { ko: '아큐브', en: 'ACUVUE', accent: '#0a3d91', tagline: '투명한 시야, 믿을 수 있는 데일리' },
  { ko: '알콘', en: 'ALCON', accent: '#0072ce', tagline: '오래가는 촉촉함의 프리미엄' },
  { ko: '쿠퍼비전', en: 'COOPERVISION', accent: '#0a9aa6', tagline: '편안한 실리콘 하이드로겔' },
  { ko: '바슈롬', en: 'BAUSCH + LOMB', accent: '#d52b1e', tagline: '선명한 컬러, 깊은 발색' },
  { ko: '클라렌', en: 'CLALEN', accent: '#6b4ea0', tagline: '자연스러운 데일리 컬러 · O2O2' },
];

function BrandShowcase() {
  return (
    <section>
      <SectionHead title="취급 제조사" sub="국내외 정품 제조사" href="/products" hrefLabel="전체 브랜드" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {BRANDS.map((b) => (
          <Link
            key={b.ko}
            href={`/products?brand=${encodeURIComponent(b.ko)}`}
            className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <span
              className="absolute inset-x-0 top-0 h-1"
              style={{ backgroundColor: b.accent }}
              aria-hidden
            />
            <span
              className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-black tracking-tight text-white"
              style={{ backgroundColor: b.accent }}
            >
              {b.en}
            </span>
            <p className="mt-3 text-sm font-bold text-gray-900">{b.ko}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{b.tagline}</p>
            <span className="mt-3 inline-flex items-center text-[11px] font-medium text-gray-400 transition group-hover:text-brand-600">
              제품 보기 →
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────── 카테고리 ─────────────────────── */
function Categories() {
  const cats = [
    { label: '컬러렌즈', sub: '아름다운 눈빛', emoji: '✦', href: '/products?type=color', dark: true },
    { label: '원데이', sub: '편리한 일회용', emoji: '○', href: '/products?type=1day' },
    { label: '난시용', sub: '토릭렌즈', emoji: '◎', href: '/products?type=toric' },
    { label: '다초점', sub: '노안 교정', emoji: '⊕', href: '/products?type=multifocal' },
  ];
  return (
    <section>
      <SectionHead title="카테고리" sub="필요에 맞게 빠르게" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cats.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className={`group flex flex-col rounded-2xl px-5 py-6 transition hover:opacity-90 ${
              c.dark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'
            }`}
          >
            <span className="text-2xl">{c.emoji}</span>
            <span className="mt-4 text-lg font-bold">{c.label}</span>
            <span className={`mt-0.5 text-xs ${c.dark ? 'text-white/60' : 'text-gray-400'}`}>{c.sub}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────── 픽업 3단계 안내 ─────────────────── */
function PickupProcess() {
  const steps = [
    { n: '01', t: '온라인 주문', d: '도수·제품을 고르고 가까운 픽업 매장을 선택하세요.' },
    { n: '02', t: '매장 입고', d: '주문이 매장으로 배송되면 알림을 보내드려요.' },
    { n: '03', t: '상담 후 수령', d: '안경사 상담을 받고 안전하게 렌즈를 받으세요.' },
  ];
  return (
    <section className="rounded-3xl bg-brand-50 px-6 py-10 md:px-10 md:py-12">
      <SectionHead title="픽업은 이렇게" sub="주문부터 수령까지 3단계" />
      <div className="grid gap-4 md:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n} className="rounded-2xl bg-white p-5">
            <span className="text-sm font-black text-brand-600">{s.n}</span>
            <p className="mt-2 text-base font-bold text-gray-900">{s.t}</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">{s.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────── 하단 CTA ─────────────────────── */
function BottomCta() {
  return (
    <section className="flex flex-col items-center gap-4 rounded-3xl border border-gray-200 px-6 py-12 text-center">
      <h2 className="text-2xl font-black tracking-tight text-gray-900 md:text-3xl">
        지금 바로 렌즈를 찾아보세요
      </h2>
      <p className="text-sm text-gray-500">처방 도수에 맞는 정품 렌즈를 추천해 드립니다.</p>
      <Link
        href="/products"
        className="rounded-full bg-brand-600 px-7 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
      >
        렌즈 쇼핑 시작 →
      </Link>
    </section>
  );
}

/* ─────────────────────── 공통 헤더 ─────────────────────── */
function SectionHead({
  title,
  sub,
  href,
  hrefLabel,
}: {
  title: string;
  sub?: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-black tracking-tight text-gray-900 md:text-xl">{title}</h2>
        {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
      </div>
      {href && (
        <Link href={href} className="shrink-0 text-xs font-medium text-gray-400 hover:text-brand-600">
          {hrefLabel ?? '더보기'} →
        </Link>
      )}
    </div>
  );
}
