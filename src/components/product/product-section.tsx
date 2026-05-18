'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { ProductCard, type ProductCardData } from './product-card';

/**
 * 카페24 스타일 상품 섹션 — '원데이(1D) 베스트' 같은 큰 제목 + 5개 카드 + 화살표 + 전체보기
 */
export function ProductSection({
  title,
  subtitle,
  viewAllHref,
  products,
}: {
  title: string;
  subtitle?: string; // 예: '베스트' (제목 아래 작은 줄)
  viewAllHref?: string;
  products: ProductCardData[];
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  function scroll(dir: -1 | 1) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  }

  if (products.length === 0) return null;

  return (
    <section className="py-6 md:py-10">
      <header className="mb-5 flex items-end justify-between gap-4 px-1">
        <div className="flex items-end gap-4">
          <h2 className="text-2xl font-bold leading-tight text-gray-900 md:text-3xl">
            {title}
            {subtitle && (
              <>
                <br />
                <span className="text-2xl font-bold md:text-3xl">{subtitle}</span>
              </>
            )}
          </h2>
          <div className="hidden gap-1.5 pb-1 md:flex">
            <ArrowButton dir="left" onClick={() => scroll(-1)} />
            <ArrowButton dir="right" onClick={() => scroll(1)} />
          </div>
        </div>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="shrink-0 pb-1 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            전체보기
          </Link>
        )}
      </header>

      {/* 데스크탑 grid (5열) + 모바일 가로 스크롤 */}
      <div
        ref={scrollRef}
        className="scrollbar-hide -mx-1 flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible lg:grid-cols-5"
      >
        {products.map((p) => (
          <div key={p.id} className="w-48 shrink-0 px-1 md:w-auto">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}

function ArrowButton({
  dir,
  onClick,
}: {
  dir: 'left' | 'right';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === 'left' ? '이전' : '다음'}
      className="grid h-9 w-9 place-items-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:border-gray-400 hover:text-gray-900"
    >
      {dir === 'left' ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      )}
    </button>
  );
}
