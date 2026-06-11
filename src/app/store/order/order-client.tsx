'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

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

const CYCLE_LABEL: Record<string, string> = {
  '1day': '원데이',
  '2week': '2주교체',
  '1month': '1개월',
  '3month': '3개월',
  '6month': '6개월',
  '1year': '연간',
};

const CYCLE_KEYS = ['1day', '2week', '1month', '3month', '6month', '1year'];
const PACK_OPTIONS = [1, 5, 6, 10, 30];

export function StoreOrderClient() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [brand, setBrand] = useState('');
  const [cycle, setCycle] = useState('');
  const [pack, setPack] = useState<number | null>(null);

  // 장바구니: lensId -> quantity
  const [cart, setCart] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ orderNumber: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const cartLines = useMemo(
    () =>
      Object.entries(cart)
        .map(([lensId, qty]) => {
          const it = itemMap.get(lensId);
          if (!it || it.supplyPrice == null) return null;
          return { item: it, qty, lineTotal: it.supplyPrice * qty };
        })
        .filter((x): x is { item: CatalogItem; qty: number; lineTotal: number } => x != null),
    [cart, itemMap],
  );

  const total = cartLines.reduce((s, l) => s + l.lineTotal, 0);
  const cartCount = cartLines.reduce((s, l) => s + l.qty, 0);

  function addToCart(id: string) {
    setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  }
  function setQty(id: string, qty: number) {
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
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
          items: cartLines.map((l) => ({ lensId: l.item.id, quantity: l.qty })),
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

        {/* 검색 */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="제품명, 브랜드, 제품코드, 컬러로 검색"
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-amber-500 focus:outline-none"
        />

        {/* 브랜드 칩 */}
        {brands.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Chip active={brand === ''} onClick={() => setBrand('')}>
              전체 브랜드
            </Chip>
            {brands.map((b) => (
              <Chip key={b} active={brand === b} onClick={() => setBrand(brand === b ? '' : b)}>
                {b}
              </Chip>
            ))}
          </div>
        )}

        {/* 교체주기 칩 */}
        <div className="flex flex-wrap gap-2">
          <span className="self-center text-xs font-semibold text-gray-400">교체주기</span>
          {CYCLE_KEYS.map((c) => (
            <Chip key={c} active={cycle === c} onClick={() => setCycle(cycle === c ? '' : c)}>
              {CYCLE_LABEL[c]}
            </Chip>
          ))}
        </div>

        {/* 갯수(매입) 칩 */}
        <div className="flex flex-wrap gap-2">
          <span className="self-center text-xs font-semibold text-gray-400">갯수</span>
          {PACK_OPTIONS.map((p) => (
            <Chip key={p} active={pack === p} onClick={() => setPack(pack === p ? null : p)}>
              {p}매입
            </Chip>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{display.length}개 제품</span>
          {hasFilter && (
            <button
              onClick={() => {
                setBrand('');
                setCycle('');
                setPack(null);
                setQuery('');
              }}
              className="underline"
            >
              필터 초기화
            </button>
          )}
        </div>

        {/* 제품 그리드 */}
        {loading ? (
          <p className="py-16 text-center text-sm text-gray-400">불러오는 중…</p>
        ) : display.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-400">조건에 맞는 제품이 없습니다.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {display.map((l) => (
              <ProductCard
                key={l.id}
                item={l}
                qtyInCart={cart[l.id] ?? 0}
                onAdd={() => addToCart(l.id)}
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
                <li key={l.item.id} className="border-b border-gray-100 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs text-gray-400">{l.item.brand}</p>
                      <p className="truncate text-sm font-medium text-gray-900">
                        {l.item.name}
                      </p>
                    </div>
                    <button
                      onClick={() => setQty(l.item.id, 0)}
                      className="shrink-0 text-xs text-gray-400 hover:text-red-500"
                      aria-label="삭제"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <QtyBtn onClick={() => setQty(l.item.id, l.qty - 1)}>−</QtyBtn>
                      <input
                        type="number"
                        min={1}
                        value={l.qty}
                        onChange={(e) => setQty(l.item.id, Math.max(0, Math.floor(Number(e.target.value))))}
                        className="w-12 rounded border border-gray-300 bg-white py-1 text-center text-sm text-gray-900"
                      />
                      <QtyBtn onClick={() => setQty(l.item.id, l.qty + 1)}>+</QtyBtn>
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
    case 'FORBIDDEN':
      return '발주 권한이 없습니다.';
    default:
      return '발주에 실패했습니다. 다시 시도해주세요.';
  }
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
        <img src={imageSrc} alt={item.name} className="h-full w-full object-contain p-2" loading="lazy" />
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
          {qtyInCart > 0 ? `담음 (${qtyInCart})` : '발주 담기'}
        </button>
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'border-amber-600 bg-amber-600 text-white'
          : 'border-gray-300 text-gray-600 hover:border-gray-400'
      }`}
    >
      {children}
    </button>
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
