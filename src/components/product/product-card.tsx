'use client';

import Link from 'next/link';
import { useState } from 'react';

export interface ProductCardData {
  id: string;
  productCode: string;
  brand: string;
  name: string;
  imageUrl: string | null; // 모델 이미지
  colorName?: string | null;
  colorHex?: string | null;
  colorPreviewUrl?: string | null; // 렌즈 컬러 이미지 (우선)
  replacementCycle: string;
  diameter?: string | number | null; // 13.0, '13.0' 등
  price: number;
  isNew?: boolean;
  variantCount?: number; // 같은 시리즈의 다른 컬러 개수 (+N가지 컬러)
}

const CYCLE_LABEL: Record<string, string> = {
  '1day': '원데이',
  '2week': '2주',
  '1month': '한달용',
  '3month': '3개월',
  '6month': '6개월',
  '1year': '1년',
};

export function ProductCard({ product, href }: { product: ProductCardData; href?: string }) {
  const [liked, setLiked] = useState(false);
  const cycle = CYCLE_LABEL[product.replacementCycle] ?? product.replacementCycle;
  const diameter = product.diameter ? `${Number(product.diameter).toFixed(1)}mm` : null;
  const fullName = product.colorName
    ? `${product.brand} ${product.name} - ${product.colorName}`
    : `${product.brand} ${product.name}`;
  const subLabel = [product.colorName, `${cycle}${diameter ? ` (${diameter})` : ''}`]
    .filter(Boolean)
    .join(' | ');

  const linkHref = href ?? `/order/new?product=${product.id}`;

  return (
    <Link
      href={linkHref}
      className="group block focus:outline-none"
      aria-label={fullName}
    >
      {/* 이미지 영역 */}
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg bg-gray-50">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={fullName}
            className="h-full w-full object-cover transition group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 text-4xl">
            👁️
          </div>
        )}

        {/* 좌상단 위시리스트 */}
        <button
          type="button"
          aria-label="찜하기"
          onClick={(e) => {
            e.preventDefault();
            setLiked((v) => !v);
          }}
          className="absolute left-2 top-2 grid h-9 w-9 place-items-center rounded-full text-white transition hover:bg-black/10"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill={liked ? '#ff4e7c' : 'none'}
            stroke={liked ? '#ff4e7c' : 'white'}
            strokeWidth="1.8"
            style={{ filter: liked ? 'none' : 'drop-shadow(0 1px 2px rgba(0,0,0,0.25))' }}
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

        {/* 우상단 NEW */}
        {product.isNew && (
          <span className="absolute right-2 top-2 rounded-full bg-pink-500 px-2.5 py-0.5 text-[11px] font-bold text-white">
            NEW
          </span>
        )}

        {/* 우하단 컬러 미리보기 */}
        <ColorPreview
          color={product.colorHex}
          imageUrl={product.colorPreviewUrl}
          alt={product.colorName ?? ''}
        />
      </div>

      {/* 텍스트 */}
      <div className="mt-3 px-1">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900 group-hover:text-brand-600">
          {fullName}
        </h3>
        {subLabel && (
          <p className="mt-1 truncate text-xs text-gray-500">{subLabel}</p>
        )}
        <div className="mt-2 flex items-baseline justify-between gap-2">
          <span className="text-base font-bold text-gray-900">
            {product.price.toLocaleString()}원
          </span>
          {product.variantCount && product.variantCount > 1 && (
            <span className="text-xs font-medium text-pink-600">
              +{product.variantCount}가지 컬러
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function ColorPreview({
  color,
  imageUrl,
  alt,
}: {
  color?: string | null;
  imageUrl?: string | null;
  alt: string;
}) {
  if (imageUrl) {
    return (
      <div className="absolute bottom-2 right-2 grid h-14 w-14 place-items-center rounded-full bg-white p-1 shadow-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={alt}
          className="h-full w-full rounded-full object-cover"
        />
      </div>
    );
  }
  if (color) {
    // radial gradient — 렌즈 외측 진한 색, 내측 투명
    return (
      <div
        className="absolute bottom-2 right-2 h-14 w-14 rounded-full bg-white p-1 shadow-md"
        aria-label={alt}
      >
        <div
          className="h-full w-full rounded-full"
          style={{
            background: `radial-gradient(circle at 35% 35%, ${color}30 0%, ${color}80 50%, ${color} 100%)`,
          }}
        />
      </div>
    );
  }
  return null;
}
