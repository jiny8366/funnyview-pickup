import Link from 'next/link';

/**
 * 홈 트렌딩 키워드 (방안B 섹션 — 기능/구조, 디자인은 #3에서 보강).
 * 해시태그형 태그 → 카탈로그 필터(/products?type=…) 또는 검색으로 이동.
 */
const KEYWORDS: { label: string; href: string }[] = [
  { label: '#원데이', href: '/products?type=1day' },
  { label: '#컬러렌즈', href: '/products?type=color' },
  { label: '#난시용', href: '/products?type=toric' },
  { label: '#다초점', href: '/products?type=multifocal' },
  { label: '#아큐브', href: '/products?brand=아큐브' },
  { label: '#바슈롬', href: '/products?brand=바슈롬' },
  { label: '#클라렌', href: '/products?brand=클라렌' },
  { label: '#쿠퍼비전', href: '/products?brand=쿠퍼비전' },
];

export function TrendingKeywords() {
  return (
    <section>
      <div className="mb-4">
        <h2 className="text-lg font-black tracking-tight text-gray-900 md:text-xl">지금 인기 키워드</h2>
        <p className="mt-0.5 text-xs text-gray-400">관심 키워드로 빠르게 찾아보세요</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {KEYWORDS.map((k) => (
          <Link
            key={k.label}
            href={k.href}
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
          >
            {k.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
