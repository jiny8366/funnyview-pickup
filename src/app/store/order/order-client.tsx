'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ProductFilterBar } from '@/components/product/product-filter-bar';
import { StoreVariantPicker, powerLabel, type PickerVariant } from './variant-picker';

interface CatalogItem {
  id: string;
  productCode: string;
  brand: string;
  name: string;
  lensType: string;
  replacementCycle: string;
  piecesPerBox: number;
  imageUrl: string | null;
  colorName: string | null;
  colorHex: string | null;
  colorPreviewUrl: string | null;
  diameter: string | null;
  supplyPrice: number | null;
}

/** 장바구니 라인 — variantId 단위. 같은 제품도 도수 다르면 별도 라인. */
interface CartLine {
  variantId: string;
  lensId: string;
  brand: string;
  name: string;
  productCode: string;
  supplyPrice: number;
  sphere: string | null;
  cylinder: string | null;
  axis: number | null;
  addPower: string | null;
  qty: number;
}

const CYCLE_LABEL: Record<string, string> = {
  '1day': '원데이',
  '2week': '2주교체',
  '1month': '1개월',
  '3month': '3개월',
  '6month': '6개월',
  '1year': '연간',
};

export function StoreOrderClient() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [brand, setBrand] = useState('');
  const [cycle, setCycle] = useState('');
  const [pack, setPack] = useState<number | null>(null);
  // 보기 모드: 기본 이미지(그리드)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // 장바구니: variantId -> CartLine (도수 단위)
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ orderNumber: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 도수 선택 모달 대상 제품
  const [picking, setPicking] = useState<CatalogItem | null>(null);

  useEffect(() => {
    fetch('/api/store/catalog')
      .then((r) => r.json())
      .then((j) => setItems(j.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  const brands = useMemo(
    () => [...new Set(items.map((l) => l.brand))].sort(),
    [items],
  );

  // 교체주기/갯수 칩 후보 — 로드된 카탈로그에서 유도
  const cycleFacets = useMemo(
    () => [...new Set(items.map((l) => l.replacementCycle))].sort(),
    [items],
  );
  const packFacets = useMemo(
    () => [...new Set(items.map((l) => l.piecesPerBox))].sort((a, b) => a - b),
    [items],
  );

  const display = useMemo(() => {
    let list = items;
    if (brand) list = list.filter((l) => l.brand === brand);
    if (cycle) list = list.filter((l) => l.replacementCycle === cycle);
    if (pack != null) list = list.filter((l) => l.piecesPerBox === pack);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.brand.toLowerCase().includes(q) ||
          l.productCode.toLowerCase().includes(q) ||
          (l.colorName ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [items, brand, cycle, pack, query]);

  const cartLines = useMemo(
    () => Object.values(cart).map((l) => ({ ...l, lineTotal: l.supplyPrice * l.qty })),
    [cart],
  );

  const total = cartLines.reduce((s, l) => s + l.lineTotal, 0);
  const cartCount = cartLines.reduce((s, l) => s + l.qty, 0);

  // 제품별 장바구니 담긴 수량(도수 합산) — 카드 배지용
  const qtyByLens = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of cartLines) m.set(l.lensId, (m.get(l.lensId) ?? 0) + l.qty);
    return m;
  }, [cartLines]);

  function addVariant(product: CatalogItem, variant: PickerVariant, quantity: number) {
    if (product.supplyPrice == null) return;
    setCart((c) => {
      const existing = c[variant.variantId];
      return {
        ...c,
        [variant.variantId]: {
          variantId: variant.variantId,
          lensId: product.id,
          brand: product.brand,
          name: product.name,
          productCode: product.productCode,
          supplyPrice: product.supplyPrice as number,
          sphere: variant.sphere,
          cylinder: variant.cylinder,
          axis: variant.axis,
          addPower: variant.addPower,
          qty: (existing?.qty ?? 0) + quantity,
        },
      };
    });
    setPicking(null);
  }

  function setQty(variantId: string, qty: number) {
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) delete next[variantId];
      else if (next[variantId]) next[variantId] = { ...next[variantId], qty };
      return next;
    });
  }

  async function placeOrder() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/store/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cartLines.map((l) => ({
            variantId: l.variantId,
            lensId: l.lensId,
            quantity: l.qty,
          })),
          note: note.trim() || undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(errorMessage(j?.error));
        return;
      }
      setDone({ orderNumber: j.order?.orderNumber ?? '' });
      setCart({});
      setNote('');
    } catch {
      setError('발주 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  const hasFilter = Boolean(brand || cycle || pack != null || query.trim());

  if (done) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-4xl">✅</p>
        <h1 className="mt-3 text-xl font-bold text-gray-900">발주가 접수되었습니다</h1>
        {done.orderNumber && (
          <p className="mt-1 text-sm text-gray-500">발주번호 {done.orderNumber}</p>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <Link
            href="/store/order/history"
            className="rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700"
          >
            내 발주 내역
          </Link>
          <button
            onClick={() => setDone(null)}
            className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            계속 발주하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      {/* ── 제품 검색/목록 ─────────────────────────── */}
      <div className="space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">발주(주문)</h1>
            <p className="mt-1 text-sm text-gray-500">
              본사(퍼니뷰)로 콘택트렌즈를 발주합니다. 표시 가격은 <strong>공급가</strong>입니다.
            </p>
          </div>
          <Link
            href="/store/order/history"
            className="hidden rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:inline-block"
          >
            내 발주 내역
          </Link>
        </header>

        {/* 검색 + 칩 필터 — 공용 ProductFilterBar (단일선택 시맨틱 유지) */}
        <ProductFilterBar
          accent="amber"
          facets={{ brands, cycles: cycleFacets, packs: packFacets }}
          values={{
            query,
            brands: brand ? new Set([brand]) : new Set(),
            cycles: cycle ? new Set([cycle]) : new Set(),
            packs: pack != null ? new Set([pack]) : new Set(),
          }}
          onQuery={setQuery}
          onToggleBrand={(b) => setBrand(brand === b ? '' : b)}
          onToggleCycle={(c) => setCycle(cycle === c ? '' : c)}
          onTogglePack={(p) => setPack(pack === p ? null : p)}
          showType={false}
          searchPlaceholder="제품명, 브랜드, 제품코드, 컬러로 검색"
          onReset={
            hasFilter
              ? () => {
                  setBrand('');
                  setCycle('');
                  setPack(null);
                  setQuery('');
                }
              : undefined
          }
        />

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">{display.length}개 제품</span>
          {/* 보기 전환 — 이미지(기본) / 목록 */}
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-0.5">
            <ViewToggle active={viewMode === 'grid'} onClick={() => setViewMode('grid')} label="이미지로 보기">
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor"><rect x="2" y="2" width="7" height="7" rx="1.5"/><rect x="11" y="2" width="7" height="7" rx="1.5"/><rect x="2" y="11" width="7" height="7" rx="1.5"/><rect x="11" y="11" width="7" height="7" rx="1.5"/></svg>
            </ViewToggle>
            <ViewToggle active={viewMode === 'list'} onClick={() => setViewMode('list')} label="목록으로 보기">
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor"><rect x="2" y="3" width="16" height="2.5" rx="1.25"/><rect x="2" y="8.75" width="16" height="2.5" rx="1.25"/><rect x="2" y="14.5" width="16" height="2.5" rx="1.25"/></svg>
            </ViewToggle>
          </div>
        </div>

        {/* 제품 목록 — 이미지(그리드) / 목록(행) */}
        {loading ? (
          <p className="py-16 text-center text-sm text-gray-400">불러오는 중…</p>
        ) : display.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-400">조건에 맞는 제품이 없습니다.</p>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {display.map((l) => (
              <ProductCard
                key={l.id}
                item={l}
                qtyInCart={qtyByLens.get(l.id) ?? 0}
                onAdd={() => setPicking(l)}
              />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
            {display.map((l) => (
              <ProductRow
                key={l.id}
                item={l}
                qtyInCart={qtyByLens.get(l.id) ?? 0}
                onAdd={() => setPicking(l)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── 장바구니 / 발주 요약 ───────────────────── */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <h2 className="text-base font-bold text-gray-900">
            발주 목록 {cartCount > 0 && <span className="text-amber-600">({cartCount})</span>}
          </h2>

          {cartLines.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">담은 제품이 없습니다.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {cartLines.map((l) => (
                <li key={l.variantId} className="border-b border-gray-100 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs text-gray-400">{l.brand}</p>
                      <p className="truncate text-sm font-medium text-gray-900">{l.name}</p>
                      <p className="mt-0.5 truncate text-xs font-medium text-amber-700">
                        {powerLabel(l) || '단일도수'}
                      </p>
                    </div>
                    <button
                      onClick={() => setQty(l.variantId, 0)}
                      className="shrink-0 text-xs text-gray-400 hover:text-red-500"
                      aria-label="삭제"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <QtyBtn onClick={() => setQty(l.variantId, l.qty - 1)}>−</QtyBtn>
                      <input
                        type="number"
                        min={1}
                        value={l.qty}
                        onChange={(e) => setQty(l.variantId, Math.max(0, Math.floor(Number(e.target.value))))}
                        className="w-12 rounded border border-gray-300 bg-white py-1 text-center text-sm text-gray-900"
                      />
                      <QtyBtn onClick={() => setQty(l.variantId, l.qty + 1)}>+</QtyBtn>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      {l.lineTotal.toLocaleString()}원
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {cartLines.length > 0 && (
            <>
              <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-3">
                <span className="text-sm font-semibold text-gray-700">총 공급 금액</span>
                <span className="text-lg font-bold text-amber-600">{total.toLocaleString()}원</span>
              </div>

              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="요청사항 (선택)"
                rows={2}
                className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-amber-500 focus:outline-none"
              />

              {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

              <button
                onClick={placeOrder}
                disabled={submitting}
                className="mt-3 w-full rounded-lg bg-amber-600 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {submitting ? '발주 처리 중…' : '발주하기'}
              </button>
            </>
          )}
        </div>
      </aside>

      {/* ── 도수+수량 선택 모달 ───────────────────── */}
      {picking && (
        <VariantModal product={picking} onClose={() => setPicking(null)} onAdd={addVariant} />
      )}
    </div>
  );
}

function errorMessage(code: string | undefined): string {
  switch (code) {
    case 'EMPTY_ITEMS':
      return '발주할 제품을 담아주세요.';
    case 'NO_SUPPLY_PRICE':
      return '공급가가 설정되지 않은 제품이 포함되어 있습니다. 본사에 문의해주세요.';
    case 'INVALID_PRODUCT':
      return '판매 중지된 제품이 포함되어 있습니다.';
    case 'INVALID_VARIANT':
      return '선택한 도수가 더 이상 유효하지 않습니다. 다시 선택해주세요.';
    case 'FORBIDDEN':
      return '발주 권한이 없습니다.';
    default:
      return '발주에 실패했습니다. 다시 시도해주세요.';
  }
}

/** 도수+수량 선택 모달 — 제품 클릭 시 해당 제품의 variants 를 불러와 선택. */
function VariantModal({
  product,
  onClose,
  onAdd,
}: {
  product: CatalogItem;
  onClose: () => void;
  onAdd: (product: CatalogItem, variant: PickerVariant, quantity: number) => void;
}) {
  const [variants, setVariants] = useState<PickerVariant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/store/lenses/${product.id}/variants`)
      .then((r) => r.json())
      .then((j) => {
        if (alive) setVariants((j.variants ?? []) as PickerVariant[]);
      })
      .catch(() => {
        if (alive) setVariants([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [product.id]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs text-gray-400">{product.brand}</p>
            <h3 className="truncate text-base font-bold text-gray-900">{product.name}</h3>
            <p className="mt-0.5 text-xs text-amber-700">
              공급가{' '}
              {product.supplyPrice == null
                ? '가격문의'
                : `${product.supplyPrice.toLocaleString()}원`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="mt-4">
          <StoreVariantPicker
            variants={variants}
            lensType={product.lensType}
            loading={loading}
            onConfirm={(variant, quantity) => onAdd(product, variant, quantity)}
          />
        </div>
      </div>
    </div>
  );
}

function ProductCard({
  item,
  qtyInCart,
  onAdd,
}: {
  item: CatalogItem;
  qtyInCart: number;
  onAdd: () => void;
}) {
  const imageSrc = item.imageUrl ?? `/api/lens-image/${item.productCode}`;
  const cycle = CYCLE_LABEL[item.replacementCycle] ?? item.replacementCycle;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="aspect-square overflow-hidden bg-gray-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={item.name}
          className="h-full w-full object-contain p-2"
          loading="lazy"
          onError={(e) => {
            const el = e.currentTarget;
            if (el.dataset.fb) return;
            el.dataset.fb = '1';
            el.src = `/api/lens-image/${item.productCode}`;
          }}
        />
      </div>
      <div className="flex flex-1 flex-col p-3">
        <p className="truncate text-[10px] text-gray-400">{item.brand}</p>
        <h3 className="line-clamp-2 text-sm font-semibold text-gray-900">{item.name}</h3>
        <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-gray-400">
          <span>{cycle}</span>
          <span>· {item.piecesPerBox}매입</span>
        </div>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <p className="text-[10px] font-semibold text-amber-600">공급가</p>
            <p className="text-sm font-bold text-gray-900">
              {item.supplyPrice == null ? (
                <span className="text-xs font-normal text-gray-400">가격문의</span>
              ) : (
                `${item.supplyPrice.toLocaleString()}원`
              )}
            </p>
          </div>
        </div>
        <button
          onClick={onAdd}
          disabled={item.supplyPrice == null}
          className="mt-2 w-full rounded-lg bg-amber-600 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {qtyInCart > 0 ? `도수 추가 (${qtyInCart})` : '발주 담기'}
        </button>
      </div>
    </div>
  );
}

function QtyBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
    >
      {children}
    </button>
  );
}

function ViewToggle({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`grid h-7 w-7 place-items-center rounded-md transition ${
        active ? 'bg-amber-600 text-white' : 'text-gray-500 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  );
}

/** 목록(행) 보기 — 작은 썸네일 + 정보 + 발주 담기 */
function ProductRow({
  item,
  qtyInCart,
  onAdd,
}: {
  item: CatalogItem;
  qtyInCart: number;
  onAdd: () => void;
}) {
  const imageSrc = item.imageUrl ?? `/api/lens-image/${item.productCode}`;
  const cycle = CYCLE_LABEL[item.replacementCycle] ?? item.replacementCycle;
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={item.name}
          className="h-full w-full object-contain p-1"
          loading="lazy"
          onError={(e) => {
            const el = e.currentTarget;
            if (el.dataset.fb) return;
            el.dataset.fb = '1';
            el.src = `/api/lens-image/${item.productCode}`;
          }}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] text-gray-400">{item.brand}</p>
        <p className="truncate text-sm font-semibold text-gray-900">{item.name}</p>
        <p className="text-[11px] text-gray-400">{cycle} · {item.piecesPerBox}매입</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[10px] font-semibold text-amber-600">공급가</p>
        <p className="text-sm font-bold text-gray-900">
          {item.supplyPrice == null ? (
            <span className="text-xs font-normal text-gray-400">가격문의</span>
          ) : (
            `${item.supplyPrice.toLocaleString()}원`
          )}
        </p>
      </div>
      <button
        onClick={onAdd}
        disabled={item.supplyPrice == null}
        className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {qtyInCart > 0 ? `도수 추가 (${qtyInCart})` : '발주 담기'}
      </button>
    </div>
  );
}
