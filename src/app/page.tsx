import { Aperture, Layers, Palette, Sun } from 'lucide-react';
import Link from 'next/link';
import { ProductCarousel } from '@/components/home/product-carousel';
import { ReviewSection } from '@/components/home/review-section';
import { SectionRenderer } from '@/components/home/section-renderer';
import { TrendingKeywords } from '@/components/home/trending-keywords';
import { SiteHeader } from '@/components/layout/site-header';
import { loadActiveSections } from '@/lib/home/load-sections';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const sections = await loadActiveSections().catch(() => []);

  return (
    <main className="animate-fade-in min-h-screen bg-white pb-safe">
      <SiteHeader />

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
        <Categories />
        <ProductCarousel title="베스트셀러" subtitle="지금 많이 찾는 렌즈" />
        <BrandShowcase />
        <TrendingKeywords />
        <PickupProcess />
        <ReviewSection />
        <BottomCta />
      </div>

      <Footer />
    </main>
  );
}

/* ───────────────────────── Hero ───────────────────────── */
function Hero() {
  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-600 via-brand-700 to-indigo-900 px-7 py-16 text-white md:px-14 md:py-28">
      {/* 컬러 메시 블롭 */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-cyan-400/30 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-1/4 h-72 w-72 rounded-full bg-fuchsia-500/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-80 w-80 rounded-full bg-sky-300/20 blur-3xl" />

      {/* 글래스 렌즈 비주얼 (데스크탑) */}
      <div className="pointer-events-none absolute -right-10 top-1/2 hidden h-[26rem] w-[26rem] -translate-y-1/2 md:block">
        <div className="absolute inset-0 rounded-full border border-white/15" />
        <div className="absolute inset-10 rounded-full border border-white/15" />
        <div className="absolute inset-20 rounded-full border border-white/10" />
        <div className="absolute inset-28 rounded-full bg-white/10 shadow-2xl backdrop-blur-2xl" />
      </div>

      <div className="relative z-10 max-w-xl">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-[11px] font-semibold tracking-wide backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
          가까운 안경원 픽업 서비스
        </span>
        <h1 className="mt-5 text-[2.5rem] font-black leading-[1.05] tracking-tight md:text-7xl">
          나의 일상 렌즈,
          <br />
          <span className="bg-gradient-to-r from-white via-cyan-100 to-sky-200 bg-clip-text text-transparent">
            안경원에서 픽업
          </span>
        </h1>
        <p className="mt-5 text-sm leading-relaxed text-white/80 md:text-lg">
          아큐브 · 알콘 · 쿠퍼비전 · 바슈롬 정품을 온라인으로 주문하고,
          <br className="hidden md:block" />
          가까운 안경원에서 안경사 상담 후 받으세요.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/products"
            className="rounded-full bg-white px-6 py-3.5 text-sm font-bold text-brand-700 shadow-lg shadow-black/10 transition hover:scale-[1.03] hover:bg-gray-50"
          >
            렌즈 둘러보기 →
          </Link>
          <Link
            href="/stores"
            className="rounded-full border border-white/40 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
          >
            가까운 매장 찾기
          </Link>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {[
            { label: '원데이', href: '/products?type=1day' },
            { label: '난시용', href: '/products?type=toric' },
            { label: '다초점', href: '/products?type=multifocal' },
            { label: '컬러렌즈', href: '/products?type=color' },
          ].map((c) => (
            <Link
              key={c.label}
              href={c.href}
              className="rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white/90 backdrop-blur transition hover:bg-white/20"
            >
              {c.label}
            </Link>
          ))}
        </div>
      </div>
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
    { label: '컬러렌즈', sub: '아름다운 눈빛', icon: <Palette size={28} strokeWidth={1.5} />, href: '/products?type=color', dark: true },
    { label: '원데이', sub: '편리한 일회용', icon: <Sun size={28} strokeWidth={1.5} />, href: '/products?type=1day' },
    { label: '난시용', sub: '토릭렌즈', icon: <Aperture size={28} strokeWidth={1.5} />, href: '/products?type=toric' },
    { label: '다초점', sub: '노안 교정', icon: <Layers size={28} strokeWidth={1.5} />, href: '/products?type=multifocal' },
  ];
  return (
    <section>
      <SectionHead title="카테고리" sub="필요에 맞게 빠르게" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cats.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className={`group flex flex-col rounded-2xl px-5 py-6 transition hover:-translate-y-0.5 hover:shadow-md ${
              c.dark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'
            }`}
          >
            <span className={c.dark ? 'text-white' : 'text-brand-600'}>{c.icon}</span>
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

/* ─────────────────────── 푸터 (사업자정보) ─────────────────────── */
// ⚠️ 법정 표기 정보 — 실제 값으로 교체 필요(전자상거래법 의무 표기). JINY 제공 시 갱신.
const COMPANY_INFO = {
  name: '(주)퍼니뷰',
  ceo: '준비 중',
  bizNo: '준비 중', // 사업자등록번호
  mailOrder: '준비 중', // 통신판매업 신고번호
  privacyOfficer: '준비 중', // 개인정보보호책임자
  address: '준비 중',
  tel: '준비 중',
  email: 'help@funnyview.co.kr',
  hours: '평일 10:00–17:00 · 점심 12:00–13:00 · 주말·공휴일 휴무',
};

function Footer() {
  const cols = [
    {
      title: '쇼핑',
      links: [
        { label: '렌즈 둘러보기', href: '/products' },
        { label: '매장 찾기', href: '/stores' },
        { label: '주문하기', href: '/customer/order' },
      ],
    },
    {
      title: '고객',
      links: [
        { label: '로그인', href: '/login' },
        { label: '회원가입', href: '/register' },
        { label: '내 주문', href: '/customer/orders' },
      ],
    },
    {
      title: '약관',
      links: [
        { label: '이용약관', href: '/terms' },
        { label: '개인정보처리방침', href: '/privacy' },
      ],
    },
  ];

  return (
    <footer className="mt-12 border-t border-gray-200 bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-base font-black tracking-tight text-gray-900">Funnyview Pickup</p>
            <p className="mt-2 max-w-xs text-xs leading-relaxed text-gray-500">
              정품 콘택트렌즈를 온라인으로 주문하고, 가까운 안경원에서 안경사 상담 후 받는 픽업 서비스.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-8 text-xs md:gap-12">
            {cols.map((col) => (
              <div key={col.title}>
                <p className="font-bold text-gray-900">{col.title}</p>
                <ul className="mt-3 space-y-2">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="text-gray-500 transition hover:text-brand-600">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 border-t border-gray-200 pt-6 text-[11px] leading-relaxed text-gray-400">
          <p className="font-semibold text-gray-600">{COMPANY_INFO.name}</p>
          <p className="mt-1.5">
            대표 {COMPANY_INFO.ceo} · 사업자등록번호 {COMPANY_INFO.bizNo} · 통신판매업신고 {COMPANY_INFO.mailOrder}
          </p>
          <p className="mt-0.5">주소 {COMPANY_INFO.address}</p>
          <p className="mt-0.5">
            고객센터 {COMPANY_INFO.tel} · {COMPANY_INFO.email} · {COMPANY_INFO.hours}
          </p>
          <p className="mt-0.5">개인정보보호책임자 {COMPANY_INFO.privacyOfficer}</p>
          <p className="mt-4 text-gray-400">© 2026 {COMPANY_INFO.name}. All rights reserved.</p>
        </div>
      </div>
    </footer>
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
