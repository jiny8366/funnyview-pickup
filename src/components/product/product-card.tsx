'use client';

import Link from 'next/link';
import { useState } from 'react';

export interface ProductCardData {
  id: string;
  productCode: string;
  brand: string;
  name: string;
  imageUrl: string | null;
  colorName?: string | null;
  colorHex?: string | null;
  colorPreviewUrl?: string | null;
  replacementCycle: string;
  diameter?: string | number | null;
  price: number;
  recommendedRetailPrice?: number | null;
  isNew?: boolean;
  variantCount?: number;
}

const CYCLE_LABEL: Record<string, string> = {
  '1day': '원데이',
  '2week': '2주',
  '1month': '한달',
  '3month': '3개월',
  '6month': '6개월',
  '1year': '1년',
};

export function ProductCard({ product, href }: { product: ProductCardData; href?: string }) {
  const [liked, setLiked] = useState(false);
  const cycle = CYCLE_LABEL[product.replacementCycle] ?? product.replacementCycle;
  const linkHref = href ?? `/products/${product.productCode}`;
  const imageSrc = product.imageUrl ?? `/api/lens-image/${product.productCode}`;
  const rrp = product.recommendedRetailPrice ?? 0;
  const onSale = rrp > product.price && product.price > 0;
  const salePct = onSale ? Math.round(((rrp - product.price) / rrp) * 100) : 0;

  return (
    <Link href={linkHref} className="group block focus:outline-none">
      {/* ── Image block ── */}
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-white ring-1 ring-gray-100 transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-0.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={product.name}
          className="h-full w-full object-contain p-2 transition-transform duration-500 group-hover:scale-[1.03]"
          loading="lazy"
        />

        {/* Heart */}
        <button
          type="button"
          aria-label="찜하기"
          onClick={(e) => {
            e.preventDefault();
            setLiked((v) => !v);
          }}
          className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full bg-black/20 backdrop-blur-sm transition hover:bg-black/40"
        >
          <svg width="15" height="15" viewBox="0 0 24 24"
            fill={liked ? '#ff4e7c' : 'none'}
            stroke={liked ? '#ff4e7c' : 'white'}
            strokeWidth="2.2"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

        {/* NEW badge */}
        {product.isNew && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-pink-500 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white shadow">
            NEW
          </span>
        )}

        {/* Color swatch */}
        <ColorSwatch hex={product.colorHex} imageUrl={product.colorPreviewUrl} name={product.colorName} />
      </div>

      {/* ── Text below image ── */}
      <div className="mt-2 px-0.5">
        <p className="truncate text-[11px] font-medium text-gray-400">{product.brand}</p>
        <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-gray-900">{product.name}</h3>
        {product.colorName && <p className="mt-0.5 text-[11px] text-gray-400">{product.colorName}</p>}
      </div>

      {/* ── Price strip ── */}
      <div className="mt-1 flex items-baseline justify-between px-0.5">
        <span className="text-xs text-gray-400">{cycle}</span>
        <div className="flex items-baseline gap-2">
          {product.variantCount && product.variantCount > 1 && (
            <span className="text-[10px] font-medium text-pink-500">
              +{product.variantCount}컬러
            </span>
          )}
          {product.price === 0 ? (
            <span className="text-xs font-normal text-gray-400">가격문의</span>
          ) : (
            <span className="flex items-baseline gap-1.5">
              {onSale && <span className="text-sm font-extrabold text-pink-500">{salePct}%</span>}
              <span className="text-sm font-bold text-gray-900">{product.price.toLocaleString()}원</span>
              {onSale && (
                <span className="text-[11px] font-normal text-gray-400 line-through">{rrp.toLocaleString()}원</span>
              )}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ── Color swatch ── */
function ColorSwatch({
  hex,
  imageUrl,
  name,
}: {
  hex?: string | null;
  imageUrl?: string | null;
  name?: string | null;
}) {
  if (imageUrl) {
    return (
      <div className="absolute bottom-10 right-2.5 h-8 w-8 overflow-hidden rounded-full border-2 border-white shadow-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={name ?? ''} className="h-full w-full object-cover" />
      </div>
    );
  }
  if (hex) {
    return (
      <div
        className="absolute bottom-10 right-2.5 h-8 w-8 rounded-full border-2 border-white shadow-md"
        style={{
          background: `radial-gradient(circle at 35% 35%, ${hex}40 0%, ${hex}99 55%, ${hex} 100%)`,
        }}
        aria-label={name ?? ''}
      />
    );
  }
  return null;
}
