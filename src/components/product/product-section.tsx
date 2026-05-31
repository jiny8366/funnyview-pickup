'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ProductCard, type ProductCardData } from './product-card';

interface CarouselOptions {
  /** layout=carousel 인지. true 면 그리드 대신 가로 스크롤 + 자동/수동 이동. */
  carousel?: boolean;
  autoplay?: boolean;
  /** 초 단위. 기본 5. */
  autoplaySeconds?: number;
  /** 좌/우 화살표 표시. 기본 true. */
  showArrows?: boolean;
  /** 닷 인디케이터 표시. 기본 false. */
  showDots?: boolean;
}

/**
 * 카페24 스타일 상품 섹션 — 큰 제목 + 카드 + 화살표 + 전체보기.
 * carousel=true 면 자동 이동/닷/스와이프 등 슬라이드 기능 활성.
 */
export function ProductSection({
  title,
  subtitle,
  viewAllHref,
  products,
  carousel,
}: {
  title: string;
  subtitle?: string;
  viewAllHref?: string;
  products: ProductCardData[];
  carousel?: CarouselOptions;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [activePage, setActivePage] = useState(0);
  const [pageCount, setPageCount] = useState(1);

  const isCarousel = !!carousel?.carousel;
  const showArrows = carousel?.showArrows !== false; // 기본 true
  const showDots = carousel?.showDots === true; // 기본 false
  const autoplay = !!carousel?.autoplay;
  const intervalSec = Math.max(2, carousel?.autoplaySeconds ?? 5);

  const scroll = useCallback((dir: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    const step = el.clientWidth * 0.8;
    let target = el.scrollLeft + dir * step;
    // 끝에 도달하면 처음/끝으로 wrap
    if (target >= el.scrollWidth - el.clientWidth - 1) {
      target = dir === 1 ? 0 : el.scrollWidth - el.clientWidth;
    } else if (target < 0) {
      target = el.scrollWidth - el.clientWidth;
    }
    el.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, []);

  // 페이지 인디케이터 계산
  useEffect(() => {
    if (!isCarousel) return;
    const el = scrollRef.current;
    if (!el) return;
    function recalc() {
      if (!el) return;
      const w = el.clientWidth;
      const total = el.scrollWidth;
      setPageCount(Math.max(1, Math.ceil(total / w)));
      setActivePage(Math.round(el.scrollLeft / w));
    }
    recalc();
    el.addEventListener('scroll', recalc, { passive: true });
    const ro = new ResizeObserver(recalc);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', recalc);
      ro.disconnect();
    };
  }, [isCarousel, products.length]);

  // 자동 이동
  useEffect(() => {
    if (!isCarousel || !autoplay) return;
    const el = scrollRef.current;
    if (!el) return;
    // 사용자가 hover/터치 중일 때 일시정지
    let paused = false;
    const onEnter = () => (paused = true);
    const onLeave = () => (paused = false);
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    el.addEventListener('touchstart', onEnter, { passive: true });
    el.addEventListener('touchend', onLeave);

    const t = setInterval(() => {
      if (paused) return;
      scroll(1);
    }, intervalSec * 1000);
    return () => {
      clearInterval(t);
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
      el.removeEventListener('touchstart', onEnter);
      el.removeEventListener('touchend', onLeave);
    };
  }, [isCarousel, autoplay, intervalSec, scroll]);

  function goToPage(p: number) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: p * el.clientWidth, behavior: 'smooth' });
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
          {showArrows && (
            <div className="hidden gap-1.5 pb-1 md:flex">
              <ArrowButton dir="left" onClick={() => scroll(-1)} />
              <ArrowButton dir="right" onClick={() => scroll(1)} />
            </div>
          )}
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

      <div
        ref={scrollRef}
        className={
          isCarousel
            ? 'scrollbar-hide -mx-1 flex gap-3 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory'
            : 'scrollbar-hide -mx-1 flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible lg:grid-cols-5'
        }
      >
        {products.map((p) => (
          <div
            key={p.id}
            className={
              isCarousel
                ? 'w-48 shrink-0 snap-start px-1 md:w-56'
                : 'w-48 shrink-0 px-1 md:w-auto'
            }
          >
            <ProductCard product={p} />
          </div>
        ))}
      </div>

      {/* 닷 인디케이터 (carousel 전용) */}
      {isCarousel && showDots && pageCount > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {Array.from({ length: pageCount }).map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${i + 1}페이지로 이동`}
              onClick={() => goToPage(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === activePage ? 'w-6 bg-gray-900' : 'w-1.5 bg-gray-300 hover:bg-gray-500'
              }`}
            />
          ))}
        </div>
      )}
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
