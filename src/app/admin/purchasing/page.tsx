'use client';

import Link from 'next/link';
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

interface OrderRow {
  id: string;
  orderNumber: string;
  status: 'ordered' | 'received' | 'cancelled';
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

  async function searchAndAdd() {
    if (!sHasFilter) return;
    setSearching(true);
    setErr(null);
    try {
      const sp = new URLSearchParams({ search: '1' });
      if (sq.trim()) sp.set('q', sq.trim());
      if (sBrands.size > 0) sp.set('brand', [...sBrands].join(','));
      if (sTypes.size > 0) sp.set('type', [...sTypes].join(','));
      if (sCycles.size > 0) sp.set('cycle', [...sCycles].join(','));
      if (sPacks.size > 0) sp.set('pack', [...sPacks].join(','));
      const res = await fetch('/api/admin/purchasing?' + sp.toString());
      const j = await res.json();
      const found: Candidate[] = j.candidates ?? [];
      if (found.length === 0) {
        setErr('검색 결과가 없습니다.');
        return;
      }
      // 기존 후보에 병합 (중복 제외) — 추가분은 체크 + 제안수량/표준단가 기본값
      setCands((prev) => {
        const base = prev ?? [];
        const have = new Set(base.map((c) => c.variantId));
        const added = found.filter((c) => !have.has(c.variantId));
        setQty((q2) => {
          const next = new Map(q2);
          added.forEach((c) => next.set(c.variantId, c.suggested));
          return next;
        });
        setCost((c2) => {
          const next = new Map(c2);
          added.forEach((c) => next.set(c.variantId, c.standardCost));
          return next;
        });
        setChecked((ch) => {
          const next = new Set(ch);
          added.forEach((c) => next.add(c.variantId));
          return next;
        });
        return [...added, ...base];
      });
      setMsg(`검색 결과 ${found.length}개 중 새 품목을 후보 상단에 추가했습니다.`);
      setTimeout(() => setMsg(null), 4000);
    } finally {
      setSearching(false);
    }
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
      setCost(new Map(list.map((c) => [c.variantId, c.standardCost])));
      setChecked(new Set(list.map((c) => c.variantId)));
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
      setMsg(`발주서 ${j.orderNumber} 생성 완료 (발주완료). 미리보기에서 인쇄·PDF·엑셀이 가능합니다.`);
      setTimeout(() => setMsg(null), 6000);
      setCands(null);
      loadOrders();
    } finally {
      setCreating(false);
    }
  }

  async function setStatus(id: string, status: 'received' | 'cancelled') {
    const label = status === 'received' ? '입고완료' : '취소';
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
          <Button size="sm" onClick={searchAndAdd} disabled={searching || !sHasFilter}>
            {searching ? '검색 중…' : '＋ 검색 결과를 후보에 추가'}
          </Button>
        </div>
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
                  <th className="px-3 py-2 text-right">예상단가</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cands.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-10 text-center text-gray-400">
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {cands.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3">
              <span className="text-sm text-gray-600">
                선택 {selectedCount}개 도수 · 예상 매입금액 <b>{totalCost.toLocaleString()}원</b>
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
                  <tr key={o.id}>
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
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/purchasing/${o.id}/print`}
                          className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                        >
                          미리보기·인쇄
                        </Link>
                        <a
                          href={`/api/admin/purchasing/${o.id}?format=csv`}
                          className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                        >
                          엑셀
                        </a>
                        {o.status === 'ordered' && (
                          <>
                            <button
                              type="button"
                              onClick={() => setStatus(o.id, 'received')}
                              className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                            >
                              입고완료
                            </button>
                            <button
                              type="button"
                              onClick={() => setStatus(o.id, 'cancelled')}
                              className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100"
                            >
                              취소
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
