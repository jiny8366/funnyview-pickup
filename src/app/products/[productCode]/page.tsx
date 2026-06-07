'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { MyPowerSelector } from '@/components/prescription/my-power-selector';
import { VariantSelector } from '@/components/product/variant-selector';
import { ProductContent } from '@/components/product/product-content';
import { SiteHeader } from '@/components/layout/site-header';
import { addItem } from '@/lib/cart/store';

interface Variant {
  variantId: string;
  sku: string;
  sphere: string;
  cylinder: string | null;
  axis: number | null;
  addPower: string | null;
  price: number;
  available: number;
}

interface Sibling {
  id: string;
  productCode: string;
  name: string;
  colorName: string | null;
  colorHex: string | null;
  colorPreviewUrl: string | null;
  imageUrl: string | null;
  price: number;
  piecesPerBox: number;
}

interface Product {
  id: string;
  productCode: string;
  brand: string;
  name: string;
  lensType: string;
  replacementCycle: string;
  piecesPerBox: number;
  price: number;
  imageUrl: string | null;
  colorName: string | null;
  colorHex: string | null;
  colorPreviewUrl: string | null;
  seriesCode: string | null;
  isNew: boolean;
  diameter: string | null;
  baseCurve: string | null;
  waterContent: string | null;
  material: string | null;
  manufacturer: string | null;
  mfdsPermitNo: string | null;
  description: string | null;
  variants: Variant[];
  siblings: Sibling[];
}

const CYCLE_LABEL: Record<string, string> = {
  '1day': '원데이',
  '2week': '2주교체',
  '1month': '1개월',
  '3month': '3개월',
  '6month': '6개월',
  '1year': '연간',
};

const LENS_TYPE_LABEL: Record<string, string> = {
  spherical: '구면 (근시/원시)',
  toric: '난시 (토릭)',
  multifocal: '다초점',
  color: '컬러렌즈',
  circle: '서클렌즈',
};

export default function ProductDetailPage() {
  const params = useParams<{ productCode: string }>();
  const productCode = params.productCode;
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [eyeSide, setEyeSide] = useState<'left' | 'right'>('left');
  const [variantId, setVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/products/${encodeURIComponent(productCode)}`)
      .then(async (r) => {
        if (r.status === 404) {
          setNotFound(true);
          return null;
        }
        if (!r.ok) throw new Error('fetch failed');
        return r.json();
      })
      .then((j: { product: Product } | null) => {
        if (j?.product) {
          setProduct(j.product);
          // 기본 도수 자동선택 안 함 — 사용자가 직접 SPH→CYL→AXIS 선택
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [productCode]);

  const selectedVariant = useMemo(
    () => product?.variants.find((v) => v.variantId === variantId) ?? null,
    [product, variantId],
  );

  const colored = product && (product.lensType === 'color' || product.lensType === 'circle');
  const imageSrc = product
    ? product.imageUrl ?? `/api/lens-image/${product.productCode}`
    : null;

  const totalPrice = (selectedVariant?.price ?? product?.price ?? 0) * quantity;

  function handleAddToCart() {
    if (!product || !selectedVariant) return;
    addItem({
      variantId: selectedVariant.variantId,
      productCode: product.productCode,
      brand: product.brand,
      name: product.name,
      colorName: product.colorName,
      imageUrl: product.imageUrl,
      cycle: product.replacementCycle,
      piecesPerBox: product.piecesPerBox,
      sphere: selectedVariant.sphere,
      cylinder: selectedVariant.cylinder,
      axis: selectedVariant.axis,
      addPower: selectedVariant.addPower,
      price: selectedVariant.price,
      quantity,
      eyeSide,
    });
    setToast('장바구니에 담았습니다');
    setTimeout(() => setToast(null), 2000);
  }

  function handleBuyNow() {
    if (!product || !selectedVariant) return;
    addItem({
      variantId: selectedVariant.variantId,
      productCode: product.productCode,
      brand: product.brand,
      name: product.name,
      colorName: product.colorName,
      imageUrl: product.imageUrl,
      cycle: product.replacementCycle,
      piecesPerBox: product.piecesPerBox,
      sphere: selectedVariant.sphere,
      cylinder: selectedVariant.cylinder,
      axis: selectedVariant.axis,
      addPower: selectedVariant.addPower,
      price: selectedVariant.price,
      quantity,
      eyeSide,
    });
    router.push('/cart');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <ShopHeader productCode={productCode} />
        <div className="mx-auto max-w-screen-xl px-4 py-10 md:px-8">
          <div className="grid gap-8 md:grid-cols-2">
            <div className="aspect-square animate-pulse rounded-2xl bg-gray-100" />
            <div className="space-y-4">
              <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
              <div className="h-8 w-2/3 animate-pulse rounded bg-gray-100" />
              <div className="h-6 w-1/2 animate-pulse rounded bg-gray-100" />
              <div className="h-32 animate-pulse rounded bg-gray-100" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="min-h-screen bg-white">
        <ShopHeader productCode={productCode} />
        <div className="py-32 text-center">
          <p className="text-4xl">🔍</p>
          <p className="mt-4 text-lg font-semibold text-gray-700">제품을 찾을 수 없습니다</p>
          <Link href="/products" className="mt-6 inline-block rounded-full bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-gray-700">
            쇼핑으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const cycle = CYCLE_LABEL[product.replacementCycle] ?? product.replacementCycle;
  const lensTypeLabel = LENS_TYPE_LABEL[product.lensType] ?? product.lensType;
  const hasVariants = product.variants.length > 0;
  const outOfStock = hasVariants && product.variants.every((v) => v.available <= 0);

  return (
    <div className="min-h-screen bg-white pb-32 md:pb-0">
      <ShopHeader productCode={productCode} />

      {/* Breadcrumb */}
      <div className="border-b border-gray-100 px-4 py-3 md:px-8">
        <div className="mx-auto max-w-screen-xl text-xs text-gray-500">
          <Link href="/products" className="hover:text-gray-900">렌즈</Link>
          <span className="mx-2 text-gray-300">/</span>
          <span className="text-gray-700">{product.brand}</span>
          <span className="mx-2 text-gray-300">/</span>
          <span className="font-medium text-gray-900">{product.name}</span>
        </div>
      </div>

      <main className="mx-auto max-w-screen-xl px-4 py-6 md:px-8 md:py-10">
        <div className="grid gap-6 md:grid-cols-2 md:gap-12">
          {/* ── Image ── */}
          <div className="md:sticky md:top-20 md:self-start">
            <div className="relative aspect-square overflow-hidden rounded-3xl bg-white ring-1 ring-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageSrc!}
                alt={product.name}
                className="h-full w-full object-contain p-4"
              />
              {product.isNew && (
                <span className="absolute left-4 top-4 rounded-full bg-pink-500 px-3 py-1 text-xs font-bold text-white shadow">
                  NEW
                </span>
              )}
              {colored && product.colorHex && (
                <div className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 shadow backdrop-blur">
                  <span
                    className="h-5 w-5 rounded-full border border-gray-200"
                    style={{ background: `radial-gradient(circle at 35% 35%, ${product.colorHex}55, ${product.colorHex})` }}
                  />
                  <span className="text-xs font-medium text-gray-700">{product.colorName}</span>
                </div>
              )}
            </div>

            {/* Series siblings (다른 컬러) */}
            {product.siblings.length > 0 && (
              <div className="mt-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  다른 컬러 ({product.siblings.length})
                </p>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                  {product.siblings.map((sib) => {
                    const sibImg = sib.imageUrl ?? `/api/lens-image/${sib.productCode}`;
                    return (
                      <Link
                        key={sib.productCode}
                        href={`/products/${sib.productCode}`}
                        className="group shrink-0"
                      >
                        <div className="relative h-16 w-16 overflow-hidden rounded-xl border-2 border-transparent transition group-hover:border-gray-900">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={sibImg} alt={sib.colorName ?? sib.name} className="h-full w-full object-cover" />
                        </div>
                        <p className="mt-1 truncate text-[10px] text-gray-500 max-w-[64px]">{sib.colorName ?? ''}</p>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Info ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              {product.brand}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900 md:text-4xl">
              {product.name}
            </h1>
            {product.colorName && (
              <p className="mt-1.5 text-sm text-gray-500">{product.colorName}</p>
            )}

            <div className="mt-5 flex flex-wrap gap-1.5">
              <Tag>{lensTypeLabel}</Tag>
              <Tag>{cycle}</Tag>
              <Tag>{product.piecesPerBox}매 / 박스</Tag>
              {product.diameter && <Tag>지름 {product.diameter}mm</Tag>}
              {product.baseCurve && <Tag>BC {product.baseCurve}</Tag>}
            </div>

            <div className="mt-6 flex items-baseline gap-3 border-y border-gray-100 py-5">
              <span className="text-3xl font-bold text-gray-900">
                {product.price === 0 ? '가격문의' : `${product.price.toLocaleString()}원`}
              </span>
              <span className="text-sm text-gray-400">/ 박스</span>
            </div>

            {/* Eye side */}
            {hasVariants && !outOfStock && (
              <div className="mt-6">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">착용 눈</p>
                <div className="flex gap-2">
                  {(['left', 'right'] as const).map((side) => (
                    <button
                      key={side}
                      onClick={() => setEyeSide(side)}
                      className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                        eyeSide === side
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : 'border-gray-200 text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      {side === 'left' ? '왼쪽 (L)' : '오른쪽 (R)'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Variant */}
            {hasVariants && (
              <div className="mt-5">
                <MyPowerSelector
                  variants={product.variants}
                  eyeSide={eyeSide}
                  onSelect={setVariantId}
                />
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  도수 선택
                </p>
                <VariantSelector
                  variants={product.variants}
                  lensType={product.lensType}
                  variantId={variantId}
                  onChange={setVariantId}
                />
              </div>
            )}

            {/* Quantity */}
            {hasVariants && !outOfStock && (
              <div className="mt-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">수량</p>
                <div className="inline-flex items-center rounded-xl border border-gray-200">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="grid h-11 w-11 place-items-center text-gray-600 hover:bg-gray-50"
                    aria-label="수량 감소"
                  >
                    −
                  </button>
                  <span className="w-12 text-center text-sm font-medium">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => q + 1)}
                    className="grid h-11 w-11 place-items-center text-gray-600 hover:bg-gray-50"
                    aria-label="수량 증가"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {/* Total */}
            {hasVariants && !outOfStock && product.price > 0 && (
              <div className="mt-6 flex items-baseline justify-between border-t border-gray-100 pt-5">
                <span className="text-sm text-gray-500">예상 결제 금액</span>
                <span className="text-2xl font-bold text-gray-900">
                  {totalPrice.toLocaleString()}원
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="mt-6 hidden gap-2 md:flex">
              {outOfStock ? (
                <button disabled className="flex-1 cursor-not-allowed rounded-2xl bg-gray-100 py-4 text-sm font-bold text-gray-400">
                  품절
                </button>
              ) : !hasVariants ? (
                <Link
                  href="/customer/order"
                  className="flex-1 rounded-2xl bg-gray-900 py-4 text-center text-sm font-bold text-white hover:bg-gray-700"
                >
                  주문 문의하기
                </Link>
              ) : (
                <>
                  <button
                    onClick={handleAddToCart}
                    disabled={!selectedVariant}
                    className="flex-1 rounded-2xl border border-gray-900 bg-white py-4 text-sm font-bold text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    장바구니 담기
                  </button>
                  <button
                    onClick={handleBuyNow}
                    disabled={!selectedVariant}
                    className="flex-1 rounded-2xl bg-gray-900 py-4 text-sm font-bold text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    바로 주문하기
                  </button>
                </>
              )}
            </div>

            {/* 상세 콘텐츠 (제조사 제공 내용) */}
            <ProductContent description={product.description} />

            {/* Spec table */}
            <div className="mt-10 border-t border-gray-100 pt-6">
              <h2 className="text-sm font-bold text-gray-900">제품 정보</h2>
              <dl className="mt-4 grid gap-3 text-sm">
                <SpecRow label="브랜드" value={product.brand} />
                <SpecRow label="제품 코드" value={product.productCode} />
                <SpecRow label="렌즈 타입" value={lensTypeLabel} />
                <SpecRow label="교체 주기" value={cycle} />
                <SpecRow label="박스당 수량" value={`${product.piecesPerBox}매`} />
                {product.diameter && <SpecRow label="직경 (DIA)" value={`${product.diameter}mm`} />}
                {product.baseCurve && <SpecRow label="베이스 커브 (BC)" value={product.baseCurve} />}
                {product.waterContent && <SpecRow label="함수율" value={`${product.waterContent}%`} />}
                {product.material && <SpecRow label="재질" value={product.material} />}
                {product.manufacturer && <SpecRow label="제조원" value={product.manufacturer} />}
                {product.mfdsPermitNo && <SpecRow label="MFDS 허가번호" value={product.mfdsPermitNo} />}
              </dl>
            </div>

            {/* Pickup notice */}
            <div className="mt-8 rounded-2xl bg-gray-50 p-5">
              <h3 className="text-sm font-bold text-gray-900">픽업 안내</h3>
              <ul className="mt-2 space-y-1 text-xs text-gray-600">
                <li>· 주문 후 가까운 매장에서 직접 픽업하는 서비스입니다</li>
                <li>· 결제는 온라인 또는 매장 직접 결제 중 선택 가능합니다</li>
                <li>· 콘택트렌즈는 의료기기로 분류되어 매장 약사/안경사 상담을 거칩니다</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile sticky bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white p-3 shadow-lg md:hidden">
        {outOfStock ? (
          <button disabled className="w-full cursor-not-allowed rounded-xl bg-gray-100 py-3.5 text-sm font-bold text-gray-400">
            품절
          </button>
        ) : !hasVariants ? (
          <Link
            href="/customer/order"
            className="block rounded-xl bg-gray-900 py-3.5 text-center text-sm font-bold text-white"
          >
            주문 문의하기
          </Link>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleAddToCart}
              disabled={!selectedVariant}
              className="flex-1 rounded-xl border border-gray-900 bg-white py-3.5 text-sm font-bold text-gray-900 disabled:opacity-50"
            >
              담기
            </button>
            <button
              onClick={handleBuyNow}
              disabled={!selectedVariant}
              className="flex-[2] rounded-xl bg-gray-900 py-3.5 text-sm font-bold text-white disabled:opacity-50"
            >
              바로 주문
            </button>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full bg-gray-900 px-5 py-2.5 text-sm font-medium text-white shadow-xl animate-fade-in md:bottom-10">
          {toast}
        </div>
      )}
    </div>
  );
}

function ShopHeader({ productCode: _productCode }: { productCode: string }) {
  return <SiteHeader />;
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-700">
      {children}
    </span>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <dt className="text-gray-500">{label}</dt>
      <dd className="col-span-2 text-gray-900">{value}</dd>
    </div>
  );
}
