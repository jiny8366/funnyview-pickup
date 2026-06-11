'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDateTime } from '@/lib/utils/format';

interface Row {
  id: string;
  status: string;
  quantityShort: number;
  note: string | null;
  createdAt: string;
  resolvedAt: string | null;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  variantId: string;
  sku: string;
  sphere: string;
  cylinder: string | null;
  axis: number | null;
  lensName: string;
  lensBrand: string;
  supplierId: string | null;
  supplierName: string | null;
}

interface Supplier {
  id: string;
  name: string;
}

interface POItem {
  brand: string;
  name: string;
  spec: string;
  sku: string;
  quantity: number;
  unitCost: number;
  amount: number;
}
interface POGroup {
  supplier: { id: string | null; name: string; bizNo: string | null; address: string | null; contact: string | null; phone: string | null };
  items: POItem[];
  totalQty: number;
  totalAmount: number;
}
interface PurchaseOrder {
  issuer: { company: string; bizNo: string; ceo: string; address: string; phone: string };
  groups: POGroup[];
}

const STATUS_LABEL: Record<string, string> = {
  requested: '급매입 대기',
  ordered: '발주됨',
  received: '입고완료',
  cancelled: '취소',
};
const STATUS_COLOR: Record<string, string> = {
  requested: 'bg-red-100 text-red-700',
  ordered: 'bg-amber-100 text-amber-700',
  received: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};
const FILTERS = [
  { key: 'requested,ordered', label: '미해결' },
  { key: 'requested', label: '급매입 대기' },
  { key: 'ordered', label: '발주됨' },
  { key: 'received', label: '입고완료' },
  { key: 'cancelled', label: '취소' },
  { key: 'requested,ordered,received,cancelled', label: '전체' },
];

type SortKey = 'product' | 'quantityShort' | 'supplier' | 'createdAt';

function spec(r: Pick<Row, 'sphere' | 'cylinder' | 'axis'>) {
  let s = `SPH ${r.sphere}`;
  if (r.cylinder) s += ` · CYL ${r.cylinder}`;
  if (r.axis != null) s += ` · AX ${r.axis}`;
  return s;
}
const won = (n: number) => n.toLocaleString('ko-KR');

export default function UrgentPurchasesPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState(FILTERS[0].key);
  const [supplierList, setSupplierList] = useState<Supplier[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortAsc, setSortAsc] = useState(false);
  const [modalIds, setModalIds] = useState<string[] | null>(null); // 열린 모달의 대상 ids
  const [poDoc, setPoDoc] = useState<PurchaseOrder | null>(null); // 인쇄용 발주서 (마지막으로 미리본 것)

  // 매입처 드롭다운 — 활성 매입처 목록
  useEffect(() => {
    fetch('/api/admin/suppliers')
      .then((r) => r.json())
      .then((j) => setSupplierList((j.suppliers ?? []).map((s: Supplier) => ({ id: s.id, name: s.name }))))
      .catch(() => setSupplierList([]));
  }, []);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/urgent-purchases?status=' + filter);
    const j = await res.json();
    setRows(j.urgentPurchases ?? []);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  // 실시간 리로드 — 모달이 열려있으면 일시정지(조작 중 깜빡임/정렬틀어짐 방지)
  useEffect(() => {
    if (modalIds) return;
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load, modalIds]);

  // 필터 변경 시 선택 초기화
  useEffect(() => {
    setSelected(new Set());
  }, [filter]);

  const sortedRows = useMemo(() => {
    if (!rows) return null;
    const arr = [...rows];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'product':
          cmp = `${a.lensBrand} ${a.lensName}`.localeCompare(`${b.lensBrand} ${b.lensName}`, 'ko');
          break;
        case 'quantityShort':
          cmp = a.quantityShort - b.quantityShort;
          break;
        case 'supplier':
          cmp = (a.supplierName ?? '').localeCompare(b.supplierName ?? '', 'ko');
          break;
        case 'createdAt':
          cmp = a.createdAt.localeCompare(b.createdAt);
          break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [rows, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  }
  const sortArrow = (key: SortKey) => (sortKey === key ? (sortAsc ? ' ▲' : ' ▼') : '');

  const shownIds = useMemo(() => (sortedRows ?? []).map((r) => r.id), [sortedRows]);
  const allShownSelected = shownIds.length > 0 && shownIds.every((id) => selected.has(id));

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    setSelected(() => (allShownSelected ? new Set() : new Set(shownIds)));
  }

  const selectedRows = useMemo(
    () => (rows ?? []).filter((r) => selected.has(r.id)),
    [rows, selected],
  );

  function openModal(ids: string[]) {
    setPoDoc(null);
    setModalIds(ids);
  }
  function closeModal() {
    setModalIds(null);
    setPoDoc(null);
  }

  const modalRows = useMemo(
    () => (modalIds && rows ? rows.filter((r) => modalIds.includes(r.id)) : []),
    [modalIds, rows],
  );

  async function afterAction() {
    await load();
    setSelected(new Set());
    closeModal();
  }

  return (
    <div className="space-y-4">
      <header className="print:hidden">
        <h1 className="text-2xl font-bold">급매입 리스트</h1>
        <p className="mt-1 text-sm text-gray-500">
          패킹 검수 중 수량 부족으로 등록된 품목 — 발주·입고 처리 후 해당 주문을 재검수·배송처리합니다
        </p>
      </header>

      <div className="flex flex-wrap gap-1.5 print:hidden">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`press rounded-full px-3 py-1 text-xs font-medium ${
              filter === f.key ? 'bg-gray-900 text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-400 print:hidden">항목명을 클릭하여 순서 변경 · 제품명을 클릭하면 처리창이 열립니다</p>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white print:hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left">
                <input
                  type="checkbox"
                  aria-label="전체 선택"
                  checked={allShownSelected}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 align-middle"
                />
              </th>
              <th className="px-3 py-2 text-left">상태</th>
              <th className="cursor-pointer select-none px-3 py-2 text-left hover:text-gray-700" onClick={() => toggleSort('product')}>
                제품 / 도수{sortArrow('product')}
              </th>
              <th className="cursor-pointer select-none px-3 py-2 text-right hover:text-gray-700" onClick={() => toggleSort('quantityShort')}>
                부족수량{sortArrow('quantityShort')}
              </th>
              <th className="cursor-pointer select-none px-3 py-2 text-left hover:text-gray-700" onClick={() => toggleSort('supplier')}>
                매입처{sortArrow('supplier')}
              </th>
              <th className="px-3 py-2 text-left">원인 주문</th>
              <th className="cursor-pointer select-none px-3 py-2 text-left hover:text-gray-700" onClick={() => toggleSort('createdAt')}>
                등록일시{sortArrow('createdAt')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedRows === null ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400">불러오는 중...</td></tr>
            ) : sortedRows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-gray-400">해당 상태의 급매입 건이 없습니다</td></tr>
            ) : (
              sortedRows.map((r) => (
                <tr key={r.id} className={selected.has(r.id) ? 'bg-blue-50/40' : ''}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label="선택"
                      checked={selected.has(r.id)}
                      onChange={() => toggleSelect(r.id)}
                      className="h-4 w-4 align-middle"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS_COLOR[r.status] ?? ''}`}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => openModal([r.id])}
                      className="text-left font-medium text-gray-900 underline-offset-2 hover:underline"
                    >
                      {r.lensBrand} {r.lensName}
                    </button>
                    <div className="text-xs text-gray-500">{spec(r)} <span className="font-mono text-[10px] text-gray-400">{r.sku}</span></div>
                    {r.note && <div className="text-xs text-gray-400">메모: {r.note}</div>}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-red-700">{r.quantityShort}박스</td>
                  <td className="px-3 py-2">
                    <span className="text-xs text-gray-600">{r.supplierName ?? '—'}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs">{r.orderNumber}</span>
                    <div className="text-[11px] text-gray-400">주문상태 {r.orderStatus}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{formatDateTime(r.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 print:hidden">
        흐름: 검수 중 부족 → 급매입 등록(주문은 처리 중 유지) → 발주확정 → 입고처리(현재고 반영) → 입고완료 → 재검수 → 배송처리
      </p>

      {/* 선택 처리 스티키 바 */}
      {selected.size > 0 && !modalIds && (
        <div className="sticky bottom-3 z-10 flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-2 shadow-lg print:hidden">
          <span className="text-sm text-gray-700">선택 <b>{selected.size}</b>건</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="press rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              선택 해제
            </button>
            <button
              type="button"
              onClick={() => openModal([...selected])}
              className="press rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
            >
              선택 {selected.size}건 처리
            </button>
          </div>
        </div>
      )}

      {modalIds && (
        <ProcessModal
          rows={modalRows}
          suppliers={supplierList}
          onClose={closeModal}
          onDone={afterAction}
          onPreview={setPoDoc}
        />
      )}

      {/* 인쇄 전용 발주서 — 화면 숨김, 인쇄 시에만 표시 */}
      <div className="hidden print:block">
        {poDoc && <PurchaseOrderDoc po={poDoc} />}
      </div>
    </div>
  );
}

/* ===================== 처리 모달 (단일 & 일괄 공용) ===================== */
function ProcessModal({
  rows,
  suppliers,
  onClose,
  onDone,
  onPreview,
}: {
  rows: Row[];
  suppliers: Supplier[];
  onClose: () => void;
  onDone: () => Promise<void>;
  onPreview: (po: PurchaseOrder | null) => void;
}) {
  const requested = rows.filter((r) => r.status === 'requested');
  const ordered = rows.filter((r) => r.status === 'ordered');
  const finished = rows.filter((r) => r.status === 'received' || r.status === 'cancelled');

  // 주 처리 대상(액션 가능한 부분집합). 혼합 선택 시 requested 우선.
  const mode: 'requested' | 'ordered' | 'finished' =
    requested.length > 0 ? 'requested' : ordered.length > 0 ? 'ordered' : 'finished';

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-4 print:hidden" onClick={onClose}>
      <div
        className="my-8 w-full max-w-3xl rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">
            급매입 처리 {rows.length > 1 ? `(${rows.length}건 일괄)` : ''}
          </h2>
          <button type="button" onClick={onClose} className="press rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100">
            닫기 ✕
          </button>
        </div>

        {mode === 'requested' && (
          <RequestedForm rows={requested} suppliers={suppliers} onDone={onDone} onPreview={onPreview} />
        )}
        {mode === 'ordered' && <OrderedForm rows={ordered} onDone={onDone} />}
        {mode === 'finished' && <FinishedView rows={finished} />}

        {/* 혼합 선택 안내 */}
        {mode !== 'finished' &&
          rows.length > (mode === 'requested' ? requested.length : ordered.length) && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              선택한 항목의 상태가 섞여 있어, <b>{mode === 'requested' ? '대기' : '발주됨'}</b> 상태 {mode === 'requested' ? requested.length : ordered.length}건만 처리합니다.
            </p>
          )}
      </div>
    </div>
  );
}

/* ----- 대기(requested): 매입처 선택 + 발주서 미리보기 + 발주확정/취소 ----- */
function RequestedForm({
  rows,
  suppliers,
  onDone,
  onPreview,
}: {
  rows: Row[];
  suppliers: Supplier[];
  onDone: () => Promise<void>;
  onPreview: (po: PurchaseOrder | null) => void;
}) {
  const [supplierId, setSupplierId] = useState('');
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const ids = rows.map((r) => r.id);

  const fetchPo = useCallback(
    async (withSupplier: boolean) => {
      // 매입처 선택이 있으면 미리보기 전에 일괄 지정(미지정/덮어쓰기) → 그래야 그룹화가 반영됨
      if (withSupplier && supplierId) {
        await Promise.all(
          ids.map((id) =>
            fetch('/api/admin/urgent-purchases', {
              method: 'PATCH',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ id, supplierId }),
            }),
          ),
        );
      }
      const res = await fetch('/api/admin/urgent-purchases/purchase-order?ids=' + ids.join(','));
      const j = (await res.json()) as PurchaseOrder;
      setPo(j);
      onPreview(j);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ids.join(','), supplierId, onPreview],
  );

  // 최초 1회 미리보기 로드
  useEffect(() => {
    fetchPo(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const csvHref = '/api/admin/urgent-purchases/purchase-order?ids=' + ids.join(',') + '&format=csv';

  async function confirmOrder() {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/urgent-purchases/order', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids, supplierId: supplierId || undefined }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.detail ?? '발주확정에 실패했습니다. 매입처를 확인하세요.');
        return;
      }
      await onDone();
    } finally {
      setBusy(false);
    }
  }

  async function cancelAll() {
    if (!confirm(`${ids.length}건을 취소하시겠습니까?`)) return;
    setBusy(true);
    try {
      await Promise.all(
        ids.map((id) =>
          fetch('/api/admin/urgent-purchases', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id, status: 'cancelled' }),
          }),
        ),
      );
      await onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* 매입처 선택 */}
      <div className="rounded-xl border border-gray-200 p-3">
        <div className="mb-2 flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">매입처 일괄 지정</label>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="h-9 min-w-[180px] rounded-md border border-gray-200 bg-white px-2 text-sm"
          >
            <option value="">선택 안 함(기존 매입처 유지)</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => fetchPo(true)}
            disabled={busy}
            className="press rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            적용 후 미리보기
          </button>
        </div>
        <ul className="space-y-0.5 text-xs text-gray-500">
          {rows.map((r) => (
            <li key={r.id}>
              · {r.lensBrand} {r.lensName} <span className="text-gray-400">{spec(r)}</span> — 현재 매입처: {r.supplierName ?? '미지정'}
            </li>
          ))}
        </ul>
      </div>

      {/* 발주서 미리보기 */}
      <div className="rounded-xl border border-gray-200 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-700">발주서 미리보기 (매입처별)</span>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => window.print()} className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
              🖨 인쇄
            </button>
            <button type="button" onClick={() => window.print()} className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
              📄 PDF 저장(인쇄→PDF)
            </button>
            <a href={csvHref} className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
              ⬇ 엑셀 다운로드
            </a>
          </div>
        </div>
        <div className="max-h-[42vh] overflow-y-auto rounded-lg border border-gray-100 bg-gray-50/40 p-2">
          {po ? <PurchaseOrderDoc po={po} compact /> : <p className="p-4 text-center text-xs text-gray-400">불러오는 중...</p>}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={cancelAll}
          disabled={busy}
          className="press rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          취소 처리
        </button>
        <button
          type="button"
          onClick={confirmOrder}
          disabled={busy}
          className="press rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          발주확정 ({ids.length}건)
        </button>
      </div>
    </div>
  );
}

/* ----- 발주됨(ordered): 입고처리 폼 (수량·단가) → 입고완료 ----- */
function OrderedForm({ rows, onDone }: { rows: Row[]; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<Record<string, { quantity: string; unitCost: string }>>({});
  const [costs, setCosts] = useState<Record<string, number>>({});

  const ids = rows.map((r) => r.id);

  // 최근단가 기본값 로드 — purchase-order 엔드포인트가 도수별 최신단가 계산을 이미 가짐
  useEffect(() => {
    fetch('/api/admin/urgent-purchases/purchase-order?ids=' + ids.join(','))
      .then((r) => r.json())
      .then((j: PurchaseOrder) => {
        const map: Record<string, number> = {};
        for (const g of j.groups) for (const it of g.items) map[it.sku] = it.unitCost;
        setCosts(map);
      })
      .catch(() => setCosts({}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(',')]);

  function field(r: Row) {
    const cur = items[r.id];
    const qty = cur?.quantity ?? String(r.quantityShort);
    const cost = cur?.unitCost ?? (costs[r.sku] != null ? String(costs[r.sku]) : '0');
    return { qty, cost };
  }
  function set(id: string, patch: Partial<{ quantity: string; unitCost: string }>) {
    setItems((prev) => {
      const r = rows.find((x) => x.id === id)!;
      const base = prev[id] ?? { quantity: String(r.quantityShort), unitCost: costs[r.sku] != null ? String(costs[r.sku]) : '0' };
      return { ...prev, [id]: { ...base, ...patch } };
    });
  }

  async function receive() {
    setBusy(true);
    try {
      const payload = {
        items: rows.map((r) => {
          const f = field(r);
          return {
            id: r.id,
            quantity: Math.max(1, Number(f.qty) || r.quantityShort),
            unitCostIncVat: Math.max(0, Number(f.cost) || 0),
          };
        }),
      };
      const res = await fetch('/api/admin/urgent-purchases/receive', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.detail ?? '입고처리에 실패했습니다.');
        return;
      }
      await onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">입고 수량과 단가를 확인하고 <b>입고완료</b>를 누르면 현재고에 반영됩니다.</p>
      <div className="overflow-hidden rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left">제품 / 도수</th>
              <th className="px-3 py-2 text-left">매입처</th>
              <th className="px-3 py-2 text-right">수량(박스)</th>
              <th className="px-3 py-2 text-right">단가(부가세 포함)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => {
              const f = field(r);
              return (
                <tr key={r.id}>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.lensBrand} {r.lensName}</div>
                    <div className="text-xs text-gray-500">{spec(r)} <span className="font-mono text-[10px] text-gray-400">{r.sku}</span></div>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">{r.supplierName ?? '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <input
                      value={f.qty}
                      onChange={(e) => set(r.id, { quantity: e.target.value.replace(/[^0-9]/g, '') })}
                      inputMode="numeric"
                      className="h-8 w-20 rounded-md border border-gray-200 px-2 text-right text-sm"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      value={f.cost}
                      onChange={(e) => set(r.id, { unitCost: e.target.value.replace(/[^0-9]/g, '') })}
                      inputMode="numeric"
                      className="h-8 w-28 rounded-md border border-gray-200 px-2 text-right text-sm"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={receive}
          disabled={busy}
          className="press rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          입고완료 ({rows.length}건) — 현재고 반영
        </button>
      </div>
    </div>
  );
}

/* ----- 완료/취소: 읽기 전용 요약 ----- */
function FinishedView({ rows }: { rows: Row[] }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-500">처리 완료된 항목입니다. 추가 작업이 없습니다.</p>
      <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
            <span>
              <span className="font-medium">{r.lensBrand} {r.lensName}</span>{' '}
              <span className="text-xs text-gray-500">{spec(r)}</span>
            </span>
            <span className="flex items-center gap-2 text-xs text-gray-500">
              <span className={`rounded px-1.5 py-0.5 ${STATUS_COLOR[r.status] ?? ''}`}>{STATUS_LABEL[r.status]}</span>
              {r.resolvedAt && formatDateTime(r.resolvedAt)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ----- 발주서 문서 (미리보기 compact + 인쇄 풀) ----- */
function PurchaseOrderDoc({ po, compact }: { po: PurchaseOrder; compact?: boolean }) {
  return (
    // .doc-light: 운영 다크 토글과 무관하게 문서는 항상 라이트(팀 규약, M1 e70f4aa)
    <div className={`doc-light ${compact ? 'space-y-4 bg-white p-2' : 'space-y-8 p-2'}`}>
      {po.groups.map((g, gi) => (
        <section key={g.supplier.id ?? `none-${gi}`} className="break-inside-avoid">
          {!compact && <h2 className="mb-2 text-center text-xl font-bold">발 주 서</h2>}
          <div className="mb-2 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-gray-200 p-2">
              <div className="mb-1 font-semibold text-gray-700">발주처(공급받는자)</div>
              <div>{po.issuer.company}</div>
              {po.issuer.ceo && <div>대표: {po.issuer.ceo}</div>}
              {po.issuer.bizNo && <div>사업자: {po.issuer.bizNo}</div>}
              {po.issuer.address && <div>{po.issuer.address}</div>}
              {po.issuer.phone && <div>Tel: {po.issuer.phone}</div>}
            </div>
            <div className="rounded-lg border border-gray-200 p-2">
              <div className="mb-1 font-semibold text-gray-700">매입처(공급자)</div>
              <div>{g.supplier.name}</div>
              {g.supplier.bizNo && <div>사업자: {g.supplier.bizNo}</div>}
              {g.supplier.contact && <div>담당: {g.supplier.contact}</div>}
              {g.supplier.phone && <div>Tel: {g.supplier.phone}</div>}
              {g.supplier.address && <div>{g.supplier.address}</div>}
            </div>
          </div>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-y border-gray-300 bg-gray-50 text-gray-600">
                <th className="px-2 py-1 text-left">브랜드</th>
                <th className="px-2 py-1 text-left">제품명</th>
                <th className="px-2 py-1 text-left">도수</th>
                <th className="px-2 py-1 text-left">SKU</th>
                <th className="px-2 py-1 text-right">수량</th>
                <th className="px-2 py-1 text-right">단가</th>
                <th className="px-2 py-1 text-right">금액</th>
              </tr>
            </thead>
            <tbody>
              {g.items.map((it, i) => (
                <tr key={`${it.sku}-${i}`} className="border-b border-gray-100">
                  <td className="px-2 py-1">{it.brand}</td>
                  <td className="px-2 py-1">{it.name}</td>
                  <td className="px-2 py-1">{it.spec}</td>
                  <td className="px-2 py-1 font-mono text-[10px]">{it.sku}</td>
                  <td className="px-2 py-1 text-right">{it.quantity}</td>
                  <td className="px-2 py-1 text-right">{won(it.unitCost)}</td>
                  <td className="px-2 py-1 text-right">{won(it.amount)}</td>
                </tr>
              ))}
              <tr className="border-t border-gray-300 font-semibold">
                <td className="px-2 py-1" colSpan={4}>합계</td>
                <td className="px-2 py-1 text-right">{g.totalQty}</td>
                <td className="px-2 py-1"></td>
                <td className="px-2 py-1 text-right">{won(g.totalAmount)}원</td>
              </tr>
            </tbody>
          </table>
        </section>
      ))}
      {po.groups.length === 0 && <p className="p-4 text-center text-xs text-gray-400">발주 대상이 없습니다.</p>}
    </div>
  );
}
