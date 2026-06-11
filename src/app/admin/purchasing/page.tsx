'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ProductFilterBar } from '@/components/product/product-filter-bar';

interface Candidate {
  variantId: string;
  sku: string;
  brand: string;
  lensName: string;
  replacementCycle: string;
  piecesPerBox: number;
  sphere: string;
  cylinder: string | null;
  axis: number | null;
  addPower: string | null;
  standardCost: number;
  lastCost: number;
  onHand: number;
  available: number;
  safetyStock: number;
  sold30d: number;
  reasonSold: boolean;
  reasonLow: boolean;
  suggested: number;
  alreadyOrdered?: boolean;
}

const TYPE_OPTIONS = [
  { value: 'spherical', label: '구면(투명)' },
  { value: 'toric', label: '난시(토릭)' },
  { value: 'multifocal', label: '멀티포컬' },
  { value: 'color', label: '컬러' },
];

function toggleInSet<T>(set: Set<T>, val: T, setter: (s: Set<T>) => void) {
  const s = new Set(set);
  if (s.has(val)) s.delete(val);
  else s.add(val);
  setter(s);
}


interface ProductHit {
  id: string;
  brand: string;
  name: string;
  lensType: string;
  replacementCycle: string;
  piecesPerBox: number;
  variantCount: number;
}

const CYCLE_LABEL: Record<string, string> = {
  '1day': '원데이', '2week': '2주', '1month': '1개월', '3month': '3개월', '6month': '6개월', '1year': '연간',
};

interface OrderRow {
  id: string;
  orderNumber: string;
  status: 'draft' | 'ordered' | 'received' | 'cancelled';
  totalCost: number;
  createdAt: string;
  receivedAt: string | null;
  supplierName: string | null;
  itemCount: number;
  skuCount: number;
}

interface Supplier {
  id: string;
  name: string;
}

const STATUS_LABEL: Record<OrderRow['status'], { label: string; cls: string }> = {
  draft: { label: '작성', cls: 'bg-amber-100 text-amber-700' },
  ordered: { label: '발주완료', cls: 'bg-blue-100 text-blue-700' },
  received: { label: '입고완료', cls: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: '취소', cls: 'bg-gray-200 text-gray-600' },
};

function doseLabel(r: { sphere: string; cylinder: string | null; axis: number | null; addPower: string | null }) {
  const parts: string[] = [];
  if (r.sphere) parts.push(`SPH ${Number(r.sphere) > 0 ? '+' : ''}${r.sphere}`);
  if (r.cylinder) parts.push(`CYL ${r.cylinder}`);
  if (r.axis !== null) parts.push(`AX ${r.axis}`);
  if (r.addPower) parts.push(`ADD ${r.addPower}`);
  return parts.join(' ') || '—';
}

/**
 * 매입 관리 (JINY) — 출고분·안전재고 미달 후보 → 매입처 선택 → 수량 조정 → 발주서 생성.
 * 발주완료 리스트는 staff 입고에서 불러와 입고처리되며, ordered 에 포함된 도수는
 * 다음 후보 리스트에서 자동 제외된다.
 */
export default function PurchasingPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [cands, setCands] = useState<Candidate[] | null>(null);
  const [supplierScoped, setSupplierScoped] = useState(false);
  const [qty, setQty] = useState<Map<string, number>>(new Map());
  const [cost, setCost] = useState<Map<string, number>>(new Map());
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  // 제품 검색 추가 (JINY) — 표준 검색으로 임의 제품을 발주 후보에 추가
  const [searchOpen, setSearchOpen] = useState(false);
  const [sq, setSq] = useState('');
  const [sBrands, setSBrands] = useState<Set<string>>(new Set());
  const [sTypes, setSTypes] = useState<Set<string>>(new Set());
  const [sCycles, setSCycles] = useState<Set<string>>(new Set());
  const [sPacks, setSPacks] = useState<Set<number>>(new Set());
  const [allBrands, setAllBrands] = useState<string[]>([]);
  const [allCycles, setAllCycles] = useState<string[]>([]);
  const [allPacks, setAllPacks] = useState<number[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    // facet 목록 — 표준 검색과 동일 소스
    fetch('/api/admin/safety-stock?facets=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        setAllBrands(j?.brands ?? []);
        setAllCycles(j?.cycles ?? []);
        setAllPacks(j?.packs ?? []);
      })
      .catch(() => {});
  }, []);

  const sHasFilter = Boolean(sq.trim() || sBrands.size || sTypes.size || sCycles.size || sPacks.size);

  // 검색 → 제품군 리스트 → 제품 선택(도수표) → 적용 → 발주리스트 병합 (JINY)
  const [productResults, setProductResults] = useState<ProductHit[] | null>(null);
  const [doseLensId, setDoseLensId] = useState<ProductHit | null>(null);

  async function searchProducts() {
    if (!sHasFilter) return;
    setSearching(true);
    setErr(null);
    try {
      const sp = new URLSearchParams({ products: '1' });
      if (sq.trim()) sp.set('q', sq.trim());
      if (sBrands.size > 0) sp.set('brand', [...sBrands].join(','));
      if (sTypes.size > 0) sp.set('type', [...sTypes].join(','));
      if (sCycles.size > 0) sp.set('cycle', [...sCycles].join(','));
      if (sPacks.size > 0) sp.set('pack', [...sPacks].join(','));
      const res = await fetch('/api/admin/purchasing?' + sp.toString());
      const j = await res.json();
      setProductResults(j.products ?? []);
      if ((j.products ?? []).length === 0) setErr('검색 결과가 없습니다.');
    } finally {
      setSearching(false);
    }
  }

  /** 도수표에서 '적용'된 도수·수량을 발주 후보 리스트에 병합 */
  function mergeIntoCands(items: { cand: Candidate; quantity: number }[]) {
    if (items.length === 0) return;
    setCands((prev) => {
      const base = prev ?? [];
      const have = new Map(base.map((c) => [c.variantId, c]));
      const added = items.filter((i) => !have.has(i.cand.variantId)).map((i) => i.cand);
      return [...added, ...base];
    });
    setQty((q2) => {
      const next = new Map(q2);
      items.forEach((i) => next.set(i.cand.variantId, i.quantity));
      return next;
    });
    setCost((c2) => {
      const next = new Map(c2);
      items.forEach((i) => {
        if (!c2.has(i.cand.variantId)) {
          next.set(i.cand.variantId, i.cand.lastCost > 0 ? i.cand.lastCost : i.cand.standardCost);
        }
      });
      return next;
    });
    setMsg(`${items.length}개 도수를 발주리스트에 추가했습니다. 발주할 품목을 체크하세요.`);
    setTimeout(() => setMsg(null), 4000);
  }

  useEffect(() => {
    fetch('/api/admin/suppliers')
      .then((r) => (r.ok ? r.json() : { suppliers: [] }))
      .then((j) => setSuppliers((j.suppliers ?? []).filter((s: Supplier & { isActive?: boolean }) => s.isActive !== false)))
      .catch(() => {});
    loadOrders();
  }, []);

  function loadOrders() {
    fetch('/api/admin/purchasing?list=1')
      .then((r) => (r.ok ? r.json() : { orders: [] }))
      .then((j) => setOrders(j.orders ?? []))
      .catch(() => setOrders([]));
  }

  async function loadCandidates() {
    setLoading(true);
    setErr(null);
    try {
      const sp = new URLSearchParams({ candidates: '1' });
      if (supplierId) sp.set('supplierId', supplierId);
      const res = await fetch('/api/admin/purchasing?' + sp.toString());
      const j = await res.json();
      const list: Candidate[] = j.candidates ?? [];
      setCands(list);
      setSupplierScoped(Boolean(j.supplierScoped));
      setQty(new Map(list.map((c) => [c.variantId, c.suggested])));
      setCost(new Map(list.map((c) => [c.variantId, c.lastCost > 0 ? c.lastCost : c.standardCost])));
      setChecked(new Set()); // 기본 미체크 — 발주할 품목만 선택 (JINY)
    } finally {
      setLoading(false);
    }
  }

  const selectedCount = checked.size;
  const totalCost = useMemo(() => {
    let sum = 0;
    for (const id of checked) sum += (qty.get(id) ?? 0) * (cost.get(id) ?? 0);
    return sum;
  }, [checked, qty, cost]);

  // 발주량 합계 (체크된 도수의 팩 수 합) — 하단 합계 표시 (JINY)
  const totalQtySum = useMemo(() => {
    let sum = 0;
    for (const id of checked) sum += qty.get(id) ?? 0;
    return sum;
  }, [checked, qty]);

  async function createOrder() {
    if (!supplierId) {
      setErr('매입거래처를 선택하세요.');
      return;
    }
    const items = [...checked]
      .map((id) => ({ variantId: id, quantity: qty.get(id) ?? 0, unitCost: cost.get(id) ?? 0 }))
      .filter((i) => i.quantity > 0);
    if (items.length === 0) {
      setErr('발주할 품목을 선택하고 수량을 입력하세요.');
      return;
    }
    setCreating(true);
    setErr(null);
    try {
      const res = await fetch('/api/admin/purchasing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ supplierId, items }),
      });
      const j = await res.json();
      if (!res.ok) {
        setErr(j.message ?? j.error ?? '발주 생성에 실패했습니다.');
        return;
      }
      setMsg(`발주서 ${j.orderNumber} 생성 완료(작성 상태) — 검토 후 '발주확정'을 눌러 확정하세요.`);
      setTimeout(() => setMsg(null), 6000);
      setCands(null);
      loadOrders();
      setDetailId(j.orderId);
    } finally {
      setCreating(false);
    }
  }

  async function setStatus(id: string, status: 'ordered' | 'received' | 'cancelled') {
    const label = status === 'ordered' ? '발주확정' : status === 'received' ? '입고완료' : '취소';
    if (!window.confirm(`이 발주서를 ${label} 처리할까요?`)) return;
    const res = await fetch(`/api/admin/purchasing/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      setErr('상태 변경에 실패했습니다.');
      return;
    }
    loadOrders();
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold md:text-2xl">매입 관리</h1>
        <p className="mt-1 text-sm text-gray-500">
          출고된 상품과 안전재고 미달 상품을 후보로 모아 매입처에 발주합니다. 발주완료 품목은 다음 후보에서 자동 제외됩니다.
        </p>
      </header>

      {msg && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>}
      {err && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}

      {/* 후보 불러오기 */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white p-3">
        <select
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
        >
          <option value="">매입거래처 선택 (전체 후보)</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={loadCandidates} disabled={loading}>
          {loading ? '분석 중…' : '📦 보충 후보 불러오기 (출고분 + 안전재고 미달)'}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setSearchOpen((v) => !v)}>
          {searchOpen ? '검색 닫기' : '🔍 제품 검색해서 추가'}
        </Button>
        {cands && supplierId && !supplierScoped && (
          <span className="text-xs text-amber-600">이 매입처의 입고 이력이 없어 전체 후보를 표시합니다.</span>
        )}
      </div>

      {/* 제품 검색 추가 — 표준 검색(검색어 + 칩)으로 임의 품목을 후보에 추가 (JINY) */}
      {searchOpen && (
        <div className="space-y-2 rounded-2xl border border-gray-200 bg-white p-3">
          <ProductFilterBar
            className="space-y-2"
            facets={{ brands: allBrands, types: TYPE_OPTIONS, cycles: allCycles, packs: allPacks }}
            values={{ query: sq, brands: sBrands, types: sTypes, cycles: sCycles, packs: sPacks }}
            onQuery={setSq}
            onToggleBrand={(b) => toggleInSet(sBrands, b, setSBrands)}
            onToggleType={(t) => toggleInSet(sTypes, t, setSTypes)}
            onToggleCycle={(c) => toggleInSet(sCycles, c, setSCycles)}
            onTogglePack={(p) => toggleInSet(sPacks, p, setSPacks)}
            searchPlaceholder="제품명 · 브랜드 · SKU 검색"
          />
          <Button size="sm" onClick={searchProducts} disabled={searching || !sHasFilter}>
            {searching ? '검색 중…' : '🔍 제품군 검색'}
          </Button>

          {/* 제품군 리스트 — 제품을 선택하면 도수표가 열림 (JINY) */}
          {productResults && productResults.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">제품</th>
                    <th className="px-3 py-2 text-left">주기 · 팩</th>
                    <th className="px-3 py-2 text-right">도수 수</th>
                    <th className="px-3 py-2 text-right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {productResults.map((pr) => (
                    <tr key={pr.id} onClick={() => setDoseLensId(pr)} className="cursor-pointer hover:bg-amber-50/40">
                      <td className="px-3 py-2 font-medium text-gray-900">{pr.brand} {pr.name}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {CYCLE_LABEL[pr.replacementCycle] ?? pr.replacementCycle} · {pr.piecesPerBox}P
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600">{pr.variantCount}</td>
                      <td className="px-3 py-2 text-right text-xs text-amber-700">도수표 열기 ›</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {doseLensId && (
        <DoseGridModal
          product={doseLensId}
          onClose={() => setDoseLensId(null)}
          onApply={(items) => {
            mergeIntoCands(items);
            setDoseLensId(null);
          }}
        />
      )}

      {/* 후보 테이블 */}
      {cands && (
        <div className="space-y-2">
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="w-8 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={cands.length > 0 && checked.size === cands.length}
                      onChange={(e) => setChecked(e.target.checked ? new Set(cands.map((c) => c.variantId)) : new Set())}
                    />
                  </th>
                  <th className="px-3 py-2 text-left">제품</th>
                  <th className="px-3 py-2 text-left">도수</th>
                  <th className="px-3 py-2 text-left">사유</th>
                  <th className="px-3 py-2 text-right">현재고</th>
                  <th className="px-3 py-2 text-right">안전재고</th>
                  {/* '출고분' — 발주(매입)된 출고분은 다음 후보에서 제외되므로 기간 표기 불필요 (JINY) */}
                  <th className="px-3 py-2 text-right">출고분</th>
                  <th className="px-3 py-2 text-right">발주수량</th>
                  {/* 단가 기본값 = 최근 매입된 입고 로트 단가 (JINY) */}
                  <th className="px-3 py-2 text-right">단가</th>
                  <th className="px-3 py-2 text-right">합계</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cands.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-10 text-center text-gray-400">
                      보충이 필요한 품목이 없습니다 (발주완료에 잡힌 품목은 제외됩니다).
                    </td>
                  </tr>
                )}
                {cands.map((c) => (
                  <tr key={c.variantId} className={checked.has(c.variantId) ? '' : 'opacity-50'}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={checked.has(c.variantId)}
                        onChange={() =>
                          setChecked((prev) => {
                            const next = new Set(prev);
                            if (next.has(c.variantId)) next.delete(c.variantId);
                            else next.add(c.variantId);
                            return next;
                          })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900">
                        {c.brand} {c.lensName}
                      </div>
                      <div className="text-[10px] font-mono text-gray-400">{c.sku}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">{doseLabel(c)}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        {c.reasonSold && (
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">출고분</span>
                        )}
                        {c.reasonLow && (
                          <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700">안전재고 미달</span>
                        )}
                        {c.alreadyOrdered && (
                          <span
                            className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
                            title="발주완료 상태의 다른 발주서에 이미 포함된 도수입니다"
                          >
                            발주중
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">{c.available}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{c.safetyStock}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{c.sold30d}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        value={qty.get(c.variantId) ?? 0}
                        onChange={(e) =>
                          setQty((prev) => new Map(prev).set(c.variantId, Math.max(0, Number(e.target.value) || 0)))
                        }
                        className="w-16 rounded border border-gray-200 px-1.5 py-1 text-right text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        value={cost.get(c.variantId) ?? 0}
                        onChange={(e) =>
                          setCost((prev) => new Map(prev).set(c.variantId, Math.max(0, Number(e.target.value) || 0)))
                        }
                        className="w-20 rounded border border-gray-200 px-1.5 py-1 text-right text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700">
                      {((qty.get(c.variantId) ?? 0) * (cost.get(c.variantId) ?? 0)).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {cands.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3">
              <span className="text-sm text-gray-600">
                선택 {selectedCount}종 · 발주량 합계 <b>{totalQtySum.toLocaleString()}팩</b> · 합계금액{' '}
                <b>{totalCost.toLocaleString()}원</b>
              </span>
              <Button onClick={createOrder} disabled={creating || selectedCount === 0 || !supplierId}>
                {creating ? '생성 중…' : '📝 발주리스트 생성 (발주완료)'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 발주서 목록 */}
      <section className="space-y-2">
        <h2 className="text-sm font-bold text-gray-900">발주서 목록</h2>
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">발주번호</th>
                <th className="px-3 py-2 text-left">매입처</th>
                <th className="px-3 py-2 text-left">상태</th>
                <th className="px-3 py-2 text-right">품목/수량</th>
                <th className="px-3 py-2 text-right">예상금액</th>
                <th className="px-3 py-2 text-left">발주일</th>
                <th className="px-3 py-2 text-right">문서/처리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!orders && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400">불러오는 중...</td></tr>
              )}
              {orders && orders.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-gray-400">발주서가 없습니다.</td></tr>
              )}
              {orders?.map((o) => {
                const s = STATUS_LABEL[o.status] ?? { label: o.status, cls: 'bg-gray-100 text-gray-600' };
                return (
                  <tr
                    key={o.id}
                    onClick={() => setDetailId(o.id)}
                    className="cursor-pointer hover:bg-gray-50"
                    title="클릭하면 발주서 자식창이 열립니다"
                  >
                    <td className="px-3 py-2 font-mono text-xs">{o.orderNumber}</td>
                    <td className="px-3 py-2">{o.supplierName ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {o.skuCount}종 / {o.itemCount}팩
                    </td>
                    <td className="px-3 py-2 text-right">{o.totalCost.toLocaleString()}원</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{new Date(o.createdAt).toLocaleDateString('ko-KR')}</td>
                    <td className="px-3 py-2 text-right text-xs text-gray-400">클릭하여 상세 ›</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {detailId && (
        <OrderDetailModal
          id={detailId}
          onClose={() => setDetailId(null)}
          onAction={(status) => {
            setStatus(detailId, status);
            setDetailId(null);
          }}
        />
      )}
    </div>
  );
}

interface DetailItem {
  id: string;
  brand: string | null;
  productName: string | null;
  sku: string | null;
  sphere: string | null;
  cylinder: string | null;
  axis: number | null;
  addPower: string | null;
  quantity: number;
  unitCost: number;
}

/**
 * 발주서 자식창 (JINY) — 미리보기 / 인쇄 / 엑셀다운로드 / 발주확정.
 * draft: 발주확정·취소 · ordered: 입고완료·취소.
 */
function OrderDetailModal({
  id,
  onClose,
  onAction,
}: {
  id: string;
  onClose: () => void;
  onAction: (status: 'ordered' | 'received' | 'cancelled') => void;
}) {
  const [data, setData] = useState<{
    order: OrderRow & { supplierName: string | null; note: string | null };
    items: DetailItem[];
  } | null>(null);

  useEffect(() => {
    fetch(`/api/admin/purchasing/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setData(j))
      .catch(() => {});
  }, [id]);

  const o = data?.order;
  const s = o ? STATUS_LABEL[o.status] ?? { label: o.status, cls: 'bg-gray-100 text-gray-600' } : null;
  const totalQty = data?.items.reduce((sum, it) => sum + it.quantity, 0) ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              발주서 {o?.orderNumber ?? ''}{' '}
              {s && <span className={`ml-1 rounded px-1.5 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>}
            </h2>
            {o && (
              <p className="mt-0.5 text-xs text-gray-500">
                매입처 {o.supplierName ?? '—'} · 발주일 {new Date(o.createdAt).toLocaleDateString('ko-KR')}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-gray-400 hover:bg-gray-100" aria-label="닫기">
            ✕
          </button>
        </header>

        {/* 미리보기 (품목) */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {!data ? (
            <p className="py-8 text-center text-sm text-gray-400">불러오는 중...</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-left text-[11px] uppercase text-gray-400">
                <tr>
                  <th className="py-1.5 pr-2">제품</th>
                  <th className="py-1.5 pr-2">도수</th>
                  <th className="py-1.5 pr-2 text-right">수량</th>
                  <th className="py-1.5 pr-2 text-right">단가</th>
                  <th className="py-1.5 text-right">합계</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.items.map((it) => (
                  <tr key={it.id}>
                    <td className="py-1.5 pr-2">
                      <span className="font-medium text-gray-900">{it.brand} {it.productName}</span>
                      <span className="ml-1 font-mono text-[10px] text-gray-400">{it.sku}</span>
                    </td>
                    <td className="py-1.5 pr-2 text-gray-600">
                      {doseLabel({ sphere: it.sphere ?? '', cylinder: it.cylinder, axis: it.axis, addPower: it.addPower })}
                    </td>
                    <td className="py-1.5 pr-2 text-right">{it.quantity}</td>
                    <td className="py-1.5 pr-2 text-right">{it.unitCost.toLocaleString()}</td>
                    <td className="py-1.5 text-right">{(it.quantity * it.unitCost).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 font-semibold">
                  <td colSpan={2} className="py-2 pr-2">합계 ({data.items.length}종)</td>
                  <td className="py-2 pr-2 text-right">{totalQty}팩</td>
                  <td />
                  <td className="py-2 text-right">{(o?.totalCost ?? 0).toLocaleString()}원</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-5 py-3">
          <div className="flex gap-2">
            <a
              href={`/admin/purchasing/${id}/print`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              🖨 미리보기·인쇄 (PDF)
            </a>
            <a
              href={`/api/admin/purchasing/${id}?format=csv`}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              ⬇ 엑셀다운로드
            </a>
          </div>
          <div className="flex gap-2">
            {o?.status === 'draft' && (
              <>
                <button
                  type="button"
                  onClick={() => onAction('cancelled')}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600 hover:bg-red-100"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => onAction('ordered')}
                  className="press rounded-lg bg-gray-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-black"
                >
                  ✅ 발주확정
                </button>
              </>
            )}
            {o?.status === 'ordered' && (
              <>
                <button
                  type="button"
                  onClick={() => onAction('cancelled')}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600 hover:bg-red-100"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => onAction('received')}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                >
                  입고완료
                </button>
              </>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}


/**
 * 도수표 모달 (JINY) — 제품의 도수(variant)를 표로 펼치고 셀에 수량을 입력해
 * '적용'하면 발주리스트에 들어간다 (수동발주).
 * 구면/컬러: SPH 목록 · 토릭: SPH × (CYL·AX) · 멀티포컬: SPH × ADD.
 */
function DoseGridModal({
  product,
  onClose,
  onApply,
}: {
  product: ProductHit;
  onClose: () => void;
  onApply: (items: { cand: Candidate; quantity: number }[]) => void;
}) {
  const [variants, setVariants] = useState<Candidate[] | null>(null);
  const [input, setInput] = useState<Map<string, number>>(new Map());
  // 난시(토릭) 검색 보조 — 우측 상단 CYL·AX 셀렉트로 그리드를 좁힘 (JINY, 발주 화면과 동일 UX)
  const [fCyl, setFCyl] = useState('');
  const [fAxis, setFAxis] = useState('');

  useEffect(() => {
    fetch(`/api/admin/purchasing?variantsOf=${product.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setVariants(j?.candidates ?? []))
      .catch(() => setVariants([]));
  }, [product.id]);

  const isToric = useMemo(() => (variants ?? []).some((v) => v.cylinder), [variants]);
  const cylOptions = useMemo(
    () => [...new Set((variants ?? []).filter((v) => v.cylinder).map((v) => v.cylinder as string))].sort((a, b) => Number(b) - Number(a)),
    [variants],
  );
  const axisOptions = useMemo(
    () =>
      [...new Set(
        (variants ?? [])
          .filter((v) => v.axis !== null && (!fCyl || v.cylinder === fCyl))
          .map((v) => String(v.axis)),
      )].sort((a, b) => Number(a) - Number(b)),
    [variants, fCyl],
  );

  // 피벗: 행 = SPH(내림차순), 열 = 토릭 'CYL·AX' | 멀티포컬 'ADD' | 그 외 단일
  // 토릭은 우측 상단 CYL·AX 셀렉트로 열을 좁혀 검색 (JINY)
  const grid = useMemo(() => {
    if (!variants) return null;
    const filtered = variants.filter(
      (v) => (!fCyl || v.cylinder === fCyl) && (!fAxis || String(v.axis) === fAxis),
    );
    const colKey = (v: Candidate) => {
      if (v.cylinder) return `CYL ${v.cylinder}${v.axis !== null ? ` · AX ${v.axis}` : ''}`;
      if (v.addPower) return `ADD ${v.addPower}`;
      return '수량';
    };
    const cols = [...new Set(filtered.map(colKey))].sort();
    const rows = [...new Set(filtered.map((v) => v.sphere))].sort((a, b) => Number(b) - Number(a));
    const cell = new Map<string, Candidate>();
    filtered.forEach((v) => cell.set(`${v.sphere}|${colKey(v)}`, v));
    return { cols, rows, cell };
  }, [variants, fCyl, fAxis]);

  const entered = useMemo(() => {
    if (!variants) return [];
    return variants
      .map((v) => ({ cand: v, quantity: input.get(v.variantId) ?? 0 }))
      .filter((i) => i.quantity > 0);
  }, [variants, input]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">도수표 — {product.brand} {product.name}</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              발주할 도수 칸에 수량을 입력하고 적용하세요. 칸 아래 회색 숫자는 현재 가용재고입니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isToric && (
              <>
                <select
                  value={fCyl}
                  onChange={(e) => {
                    setFCyl(e.target.value);
                    setFAxis('');
                  }}
                  className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                >
                  <option value="">난시도수 전체</option>
                  {cylOptions.map((c) => (
                    <option key={c} value={c}>CYL {c}</option>
                  ))}
                </select>
                <select
                  value={fAxis}
                  onChange={(e) => setFAxis(e.target.value)}
                  className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                >
                  <option value="">축 전체</option>
                  {axisOptions.map((a) => (
                    <option key={a} value={a}>AX {a}</option>
                  ))}
                </select>
              </>
            )}
            <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-gray-400 hover:bg-gray-100" aria-label="닫기">
              ✕
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto px-5 py-3">
          {!grid ? (
            <p className="py-8 text-center text-sm text-gray-400">도수 불러오는 중...</p>
          ) : grid.rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">활성 도수가 없습니다.</p>
          ) : (
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-white px-2 py-1.5 text-left text-[11px] uppercase text-gray-400">SPH</th>
                  {grid.cols.map((c) => (
                    <th key={c} className="px-2 py-1.5 text-center text-[11px] text-gray-500 whitespace-nowrap">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.rows.map((r) => (
                  <tr key={r} className="border-t border-gray-50">
                    <td className="sticky left-0 bg-white px-2 py-1 font-medium text-gray-800 whitespace-nowrap">
                      {Number(r) > 0 ? `+${r}` : r}
                    </td>
                    {grid.cols.map((c) => {
                      const v = grid.cell.get(`${r}|${c}`);
                      if (!v) return <td key={c} className="px-2 py-1 text-center text-gray-200">·</td>;
                      return (
                        <td key={c} className="px-1 py-1 text-center">
                          <input
                            type="number"
                            min={0}
                            value={input.get(v.variantId) || ''}
                            placeholder="0"
                            onChange={(e) =>
                              setInput((prev) => {
                                const next = new Map(prev);
                                const n = Math.max(0, Number(e.target.value) || 0);
                                if (n === 0) next.delete(v.variantId);
                                else next.set(v.variantId, n);
                                return next;
                              })
                            }
                            className="w-14 rounded border border-gray-200 px-1 py-0.5 text-center focus:border-amber-500 focus:outline-none"
                          />
                          <div className="mt-0.5 text-[9px] text-gray-300">{v.available}</div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
          <span className="text-xs text-gray-500">
            입력 {entered.length}개 도수 · 합계 {entered.reduce((s2, i) => s2 + i.quantity, 0)}팩
          </span>
          <button
            type="button"
            disabled={entered.length === 0}
            onClick={() => onApply(entered)}
            className="press rounded-lg bg-gray-900 px-4 py-2 text-xs font-bold text-white hover:bg-black disabled:opacity-50"
          >
            ✅ 적용 — 발주리스트에 추가
          </button>
        </footer>
      </div>
    </div>
  );
}
