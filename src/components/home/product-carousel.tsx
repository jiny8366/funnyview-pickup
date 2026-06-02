'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatKRW } from '@/lib/utils/format';

interface CatalogItem {
  id: string;
  productCode: string;
  brand: string;
  name: string;
  price: number;
  imageUrl: string | null;
}

/**
 * 홈 베스트셀러/추천 캐러셀 (방안B 섹션 — 기능/데이터, 디자인은 #3에서 보강).
 * /api/catalog 에서 받아 가로 스크롤로 노출. 기본은 이미지 있는 상품만.
 */
export function ProductCarousel({
  title,
  subtitle,
  limit = 12,
  withImageOnly = true,
}: {
  title: string;
  subtitle?: string;
  limit?: number;
  withImageOnly?: boolean;
}) {
  const [items, setItems] = useState<CatalogItem[]>([]);

  useEffect(() => {
    fetch('/api/catalog')
      .then((r) => r.json())
      .then((j) => {
        let list: CatalogItem[] = Array.isArray(j?.lenses) ? j.lenses : [];
        if (withImageOnly) list = list.filter((x) => x.imageUrl);
        setItems(list.slice(0, limit));
      })
      .catch(() => setItems([]));
  }, [limit, withImageOnly]);

  if (items.length === 0) return null;

  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-black tracking-tight text-gray-900 md:text-xl">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>}
        </div>
        <Link href="/products" className="shrink-0 text-xs font-medium text-gray-400 hover:text-brand-600">
          더보기 →
        </Link>
      </div>

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        {items.map((p) => (
          <Link key={p.id} href={`/products/${p.productCode}`} className="group w-36 shrink-0 md:w-44">
            <div className="aspect-square overflow-hidden rounded-2xl bg-gray-50">
              {p.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.imageUrl}
                  alt={p.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              )}
            </div>
            <p className="mt-2 text-[11px] font-medium text-gray-400">{p.brand}</p>
            <p className="line-clamp-1 text-sm font-bold text-gray-900">{p.name}</p>
            <p className="mt-0.5 text-sm font-semibold text-gray-900">{formatKRW(p.price)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
