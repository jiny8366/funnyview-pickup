'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ProductFilterBar, cycleLabel } from '@/components/product/product-filter-bar';

interface LensRow {
  id: string;
  brand: string;
  name: string;
  productCode: string;
  replacementCycle: string;
  piecesPerBox: number;
}

interface StoreProductCommission {
  id: string;
  lensId: string;
  commissionRate: string;
  supplyPrice: string | null;
  brand: string;
  name: string;
  productCode: string;
  inheritedGroupProductRate: string | null;
  inheritedGroupProductSupplyPrice: string | null;
}

interface HistoryRow {
  id: string;
  lensId: string;
  brand: string | null;
  productName: string | null;
  action: string;
  oldRate: string | null;
  newRate: string | null;
  oldSupplyPrice: string | null;
  newSupplyPrice: string | null;
  changedAt: string;
  changedByLabel: string | null;
}

const ACTION_LABEL: Record<string, string> = {
  set: '신규',
  update: '변경',
  delete: '삭제',
};

const inputCls =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none';

const fmtWon = (v: string | null | undefined) =>
  v == null || v === '' ? null : `${Number(v).toLocaleString('ko-KR')}원`;

/**
 * 매장 × 제품 수수료율 오버라이드 + 변경이력.
 * 멀티셀렉트: 칩/검색 → 결과 리스트(체크박스) → "선택한 제품" → 공급가/할인율 일괄 저장.
 * 자체적으로 매장/그룹 전체율(상속 힌트)·렌즈 목록·오버라이드·이력을 로드한다.
 */
export function StoreProductCommissions({ storeId }: { storeId: string }) {
  const [items, setItems] = useState<StoreProductCommission[]>([]);
  const [lenses, setLenses] = useState<LensRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [storeOverallRate, setStoreOverallRate] = useState<string>('0');
  const [groupOverallRate, setGroupOverallRate] = useState<string | null>(null);

  // 검색/필터 상태
  const [query, setQuery] = useState('');
  const [brands, setBrands] = useState<Set<string>>(new Set());
  const [cycles, setCycles] = useState<Set<string>>(new Set());
  const [packs, setPacks] = useState<Set<number>>(new Set());

  // 멀티셀렉트 상태
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [supplyPrice, setSupplyPrice] = useState('');
  const [discountRate, setDiscountRate] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function loadHistory() {
    try {
      const hr = await fetch(`/api/admin/stores/${storeId}/commission-history`).then((r) => r.json());
      setHistory(hr.history ?? []);
    } catch {
      /* 이력 로드 실패는 치명적이지 않음 */
    }
  }

  async function load() {
    try {
      const [cr, lr, sr] = await Promise.all([
        fetch(`/api/admin/stores/${storeId}/product-commissions`).then((r) => r.json()),
        fetch('/api/admin/lenses').then((r) => r.json()),
        fetch(`/api/admin/stores/${storeId}`).then((r) => r.json()),
      ]);
      setItems(cr.commissions ?? []);
      setLenses(
        (lr.lenses ?? []).map((l: LensRow) => ({
          id: l.id,
          brand: l.brand,
          name: l.name,
          productCode: l.productCode,
          replacementCycle: l.replacementCycle,
          piecesPerBox: l.piecesPerBox,
        })),
      );
      const s = sr.store;
      if (s) {
        setStoreOverallRate(s.commissionRate ?? '0');
        setGroupOverallRate(s.groupCommissionRate ?? null);
      }
      await loadHistory();
    } catch {
      setMsg('불러오기 실패');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const overriddenIds = useMemo(() => new Set(items.map((i) => i.lensId)), [items]);
  const lensById = useMemo(() => new Map(lenses.map((l) => [l.id, l])), [lenses]);

  // 필터 칩 후보 (현재 렌즈 목록에서 유도)
  const allBrands = useMemo(
    () => Array.from(new Set(lenses.map((l) => l.brand))).sort(),
    [lenses],
  );
  const allCycles = useMemo(
    () => Array.from(new Set(lenses.map((l) => l.replacementCycle))).sort(),
    [lenses],
  );
  const allPacks = useMemo(
    () => Array.from(new Set(lenses.map((l) => l.piecesPerBox))).sort((a, b) => a - b),
    [lenses],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hasFilter = q !== '' || brands.size > 0 || cycles.size > 0 || packs.size > 0;
    if (!hasFilter) return [];
    return lenses
      .filter((l) => {
        if (brands.size > 0 && !brands.has(l.brand)) return false;
        if (cycles.size > 0 && !cycles.has(l.replacementCycle)) return false;
        if (packs.size > 0 && !packs.has(l.piecesPerBox)) return false;
        if (q) {
          return (
            l.brand.toLowerCase().includes(q) ||
            l.name.toLowerCase().includes(q) ||
            l.productCode.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .slice(0, 50);
  }, [query, brands, cycles, packs, lenses]);

  // 선택 제품의 상속(fallback) 참고치 — placeholder/힌트용
  const inheritedHint = useMemo(() => {
    const so = Number(storeOverallRate);
    if (Number.isFinite(so) && so > 0) return `매장 전체 ${storeOverallRate}%`;
    if (groupOverallRate != null && Number(groupOverallRate) > 0)
      return `그룹 전체 ${groupOverallRate}%`;
    return '0%';
  }, [storeOverallRate, groupOverallRate]);

  function toggle<T>(set: Set<T>, val: T, setter: (s: Set<T>) => void) {
    const s = new Set(set);
    if (s.has(val)) s.delete(val);
    else s.add(val);
    setter(s);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((l) => selectedIds.has(l.id));

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      if (allFilteredSelected) {
        filtered.forEach((l) => s.delete(l.id));
      } else {
        filtered.forEach((l) => s.add(l.id));
      }
      return s;
    });
  }

  const selectedLenses = useMemo(
    () => Array.from(selectedIds).map((id) => lensById.get(id)).filter((l): l is LensRow => !!l),
    [selectedIds, lensById],
  );

  async function save() {
    if (selectedIds.size === 0) {
      setMsg('제품을 한 개 이상 선택하세요');
      return;
    }
    const sp = supplyPrice.trim();
    const dr = discountRate.trim();
    if (sp === '' && dr === '') {
      setMsg('공급가 또는 할인율 중 하나는 입력하세요');
      return;
    }
    if (sp !== '' && Number.isNaN(Number(sp))) {
      setMsg('공급가가 올바르지 않습니다');
      return;
    }
    if (dr !== '' && Number.isNaN(Number(dr))) {
      setMsg('할인율이 올바르지 않습니다');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/stores/${storeId}/product-commissions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          lensIds: Array.from(selectedIds),
          supplyPrice: sp === '' ? null : sp,
          discountRate: dr === '' ? null : dr,
        }),
      });
      if (!res.ok) throw new Error();
      setMsg('저장되었습니다');
      setSelectedIds(new Set());
      setSupplyPrice('');
      setDiscountRate('');
      setQuery('');
      await load();
    } catch {
      setMsg('저장 실패');
    } finally {
      setBusy(false);
    }
  }

  async function remove(lensId: string) {
    if (
      typeof window !== 'undefined' &&
      !window.confirm('이 제품 오버라이드를 삭제할까요? 삭제하면 상속값이 적용됩니다.')
    ) {
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(
        `/api/admin/stores/${storeId}/product-commissions?lensId=${encodeURIComponent(lensId)}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setMsg('삭제 실패');
    } finally {
      setBusy(false);
    }
  }

  async function clearHistory() {
    if (
      typeof window !== 'undefined' &&
      !window.confirm('이력을 삭제할까요? 백업 후 진행을 권장합니다.')
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/stores/${storeId}/commission-history`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
      await loadHistory();
    } catch {
      setMsg('이력 삭제 실패');
    } finally {
      setBusy(false);
    }
  }

  function inheritedFor(item: StoreProductCommission): string {
    if (item.inheritedGroupProductRate != null && Number(item.inheritedGroupProductRate) >= 0) {
      const sp = fmtWon(item.inheritedGroupProductSupplyPrice);
      return sp
        ? `그룹×제품 ${item.inheritedGroupProductRate}% · ${sp}`
        : `그룹×제품 ${item.inheritedGroupProductRate}%`;
    }
    return inheritedHint;
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="mb-1 text-sm font-bold text-gray-900">제품별 공급가·할인율 (매장 오버라이드)</h2>
      <p className="mb-4 text-xs text-gray-500">
        선택한 제품에만 적용되는 매장 공급가/할인율입니다(가장 구체적). 미설정 제품은 상속값(그룹×제품 → 매장 전체 → 그룹 전체)이 적용됩니다. 정산은 공급가 우선(있으면 공급가, 없으면 할인율).
      </p>

      {/* 제품 검색 — 공용 ProductFilterBar (검색 + 브랜드/교체주기/갯수 칩) */}
      <div className="mb-3">
        <ProductFilterBar
          facets={{ brands: allBrands, cycles: allCycles, packs: allPacks }}
          values={{ query, brands, cycles, packs }}
          onQuery={setQuery}
          onToggleBrand={(b) => toggle(brands, b, setBrands)}
          onToggleCycle={(c) => toggle(cycles, c, setCycles)}
          onTogglePack={(p) => toggle(packs, p, setPacks)}
          showType={false}
          searchPlaceholder="제품 검색 (브랜드/제품명/코드)"
        />
      </div>

      {/* 검색 결과 리스트 (체크박스 + 전체선택) */}
      {filtered.length > 0 && (
        <div className="mb-3 overflow-hidden rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={toggleSelectAll}
              aria-label="전체선택"
            />
            <span>검색결과 {filtered.length}개 — 전체선택</span>
          </div>
          <ul className="max-h-72 divide-y divide-gray-100 overflow-auto">
            {filtered.map((l) => (
              <li key={l.id}>
                <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(l.id)}
                    onChange={() => toggleSelect(l.id)}
                  />
                  <span className="flex-1">
                    <span className="font-medium text-gray-900">{l.brand}</span>{' '}
                    <span className="text-gray-700">{l.name}</span>{' '}
                    <span className="text-xs text-gray-500">
                      {cycleLabel(l.replacementCycle)} · {l.piecesPerBox}P
                    </span>{' '}
                    <span className="font-mono text-xs text-gray-400">{l.productCode}</span>
                  </span>
                  {overriddenIds.has(l.id) && (
                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700">
                      설정됨
                    </span>
                  )}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 선택한 제품 리스트 */}
      {selectedLenses.length > 0 && (
        <div className="mb-3 rounded-lg border border-brand-200 bg-gray-50 p-3">
          <div className="mb-2 text-xs font-medium text-gray-600">
            선택한 제품 {selectedLenses.length}개
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selectedLenses.map((l) => (
              <span
                key={l.id}
                className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700"
              >
                <span className="font-medium text-gray-900">{l.brand}</span>
                <span>{l.name}</span>
                <span className="font-mono text-gray-400">{l.productCode}</span>
                <button
                  type="button"
                  onClick={() => toggleSelect(l.id)}
                  className="ml-0.5 text-gray-400 hover:text-gray-700"
                  aria-label="선택 해제"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 공급가 / 할인율 입력 + 일괄 저장 */}
      <div className="mb-4 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">가맹점 공급가 (원)</label>
          <input
            type="number"
            step="1"
            value={supplyPrice}
            onChange={(e) => setSupplyPrice(e.target.value)}
            placeholder="예: 8000"
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">가맹점 할인율 (%)</label>
          <input
            type="number"
            step="0.01"
            value={discountRate}
            onChange={(e) => setDiscountRate(e.target.value)}
            placeholder={`상속: ${inheritedHint}`}
            className={inputCls}
          />
        </div>
        <div className="flex items-end">
          <Button type="button" onClick={save} disabled={busy || selectedIds.size === 0}>
            저장
          </Button>
        </div>
      </div>
      <p className="mb-3 text-xs text-gray-400">공급가/할인율 중 최소 하나 입력. 선택한 모든 제품에 동일 적용됩니다.</p>
      {msg && <p className="mb-3 text-sm text-gray-600">{msg}</p>}

      {/* 오버라이드 목록 */}
      {items.length === 0 ? (
        <p className="px-1 py-4 text-sm text-gray-500">설정된 제품별 오버라이드가 없습니다.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">브랜드</th>
                <th className="px-3 py-2 text-left">제품명</th>
                <th className="px-3 py-2 text-left">코드</th>
                <th className="px-3 py-2 text-right">공급가(원)</th>
                <th className="px-3 py-2 text-right">할인율</th>
                <th className="px-3 py-2 text-left">상속값(참고)</th>
                <th className="px-3 py-2 text-right">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((it) => (
                <tr key={it.id}>
                  <td className="px-3 py-2 font-medium text-gray-900">{it.brand}</td>
                  <td className="px-3 py-2 text-gray-700">{it.name}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-400">{it.productCode}</td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      step="1"
                      defaultValue={it.supplyPrice ?? ''}
                      placeholder="—"
                      onBlur={async (e) => {
                        const v = e.target.value.trim();
                        const cur = it.supplyPrice ?? '';
                        if (v === cur) return;
                        if (v !== '' && Number.isNaN(Number(v))) return;
                        setBusy(true);
                        await fetch(`/api/admin/stores/${storeId}/product-commissions`, {
                          method: 'POST',
                          headers: { 'content-type': 'application/json' },
                          body: JSON.stringify({ lensId: it.lensId, supplyPrice: v === '' ? null : v }),
                        });
                        setBusy(false);
                        await load();
                      }}
                      className="w-28 rounded border border-gray-200 px-2 py-1 text-right text-sm focus:border-brand-500 focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={it.commissionRate}
                      onBlur={async (e) => {
                        const v = e.target.value.trim();
                        if (v === '' || v === it.commissionRate || Number.isNaN(Number(v))) return;
                        setBusy(true);
                        await fetch(`/api/admin/stores/${storeId}/product-commissions`, {
                          method: 'POST',
                          headers: { 'content-type': 'application/json' },
                          body: JSON.stringify({ lensId: it.lensId, discountRate: v }),
                        });
                        setBusy(false);
                        await load();
                      }}
                      className="w-24 rounded border border-gray-200 px-2 py-1 text-right text-sm focus:border-brand-500 focus:outline-none"
                    />
                    <span className="ml-1 text-gray-400">%</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-400">{inheritedFor(it)}</td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="danger"
                      type="button"
                      onClick={() => remove(it.lensId)}
                      disabled={busy}
                    >
                      삭제
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 변경이력 */}
      <div className="mt-8">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">변경이력</h3>
          <div className="flex items-center gap-2">
            <a
              href={`/api/admin/stores/${storeId}/commission-history?format=csv`}
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              ⬇ 백업(엑셀)
            </a>
            <Button
              size="sm"
              variant="danger"
              type="button"
              onClick={clearHistory}
              disabled={busy || history.length === 0}
            >
              이력 삭제
            </Button>
          </div>
        </div>
        {history.length === 0 ? (
          <p className="px-1 py-4 text-sm text-gray-500">변경이력이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">일시</th>
                  <th className="px-3 py-2 text-left">제품</th>
                  <th className="px-3 py-2 text-left">동작</th>
                  <th className="px-3 py-2 text-right">이전 → 변경율</th>
                  <th className="px-3 py-2 text-right">이전 → 변경공급가</th>
                  <th className="px-3 py-2 text-left">변경자</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {new Date(h.changedAt).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {h.brand ? <span className="font-medium text-gray-900">{h.brand}</span> : null}{' '}
                      {h.productName ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{ACTION_LABEL[h.action] ?? h.action}</td>
                    <td className="px-3 py-2 text-right text-gray-700">
                      <span className="text-gray-400">{h.oldRate != null ? `${h.oldRate}%` : '—'}</span>
                      {' → '}
                      <span className="font-medium">{h.newRate != null ? `${h.newRate}%` : '—'}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700">
                      <span className="text-gray-400">{fmtWon(h.oldSupplyPrice) ?? '—'}</span>
                      {' → '}
                      <span className="font-medium">{fmtWon(h.newSupplyPrice) ?? '—'}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{h.changedByLabel ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
