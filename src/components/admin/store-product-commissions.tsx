'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';

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
  brand: string;
  name: string;
  productCode: string;
  inheritedGroupProductRate: string | null;
}

interface HistoryRow {
  id: string;
  lensId: string;
  brand: string | null;
  productName: string | null;
  action: string;
  oldRate: string | null;
  newRate: string | null;
  changedAt: string;
  changedByLabel: string | null;
}

// 교체주기 코드 → 한글 라벨 (어드민 제품마스터와 동일 표기)
const CYCLE_LABEL: Record<string, string> = {
  '1day': '원데이',
  '2week': '2주',
  '1month': '1개월',
  '3month': '3개월',
  '6month': '6개월',
  '1year': '1년',
  daily: '원데이',
  biweekly: '2주',
  monthly: '월간',
  quarterly: '분기',
  yearly: '장기',
};
const cycleLabel = (v: string) => CYCLE_LABEL[v] ?? v;

const ACTION_LABEL: Record<string, string> = {
  set: '신규',
  update: '변경',
  delete: '삭제',
};

const inputCls =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none';

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
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-xs transition ${
        active ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-14 shrink-0 pt-1 text-xs font-medium text-gray-600">{label}</div>
      <div className="flex flex-1 flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/**
 * 매장 × 제품 수수료율 오버라이드 + 변경이력.
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

  const [selectedLensId, setSelectedLensId] = useState('');
  const [rate, setRate] = useState('');
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
      .slice(0, 30);
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

  async function save() {
    if (!selectedLensId) {
      setMsg('제품을 선택하세요');
      return;
    }
    if (rate.trim() === '' || Number.isNaN(Number(rate))) {
      setMsg('수수료율을 입력하세요');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/stores/${storeId}/product-commissions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lensId: selectedLensId, commissionRate: rate.trim() }),
      });
      if (!res.ok) throw new Error();
      setMsg('저장되었습니다');
      setSelectedLensId('');
      setQuery('');
      setRate('');
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
    if (item.inheritedGroupProductRate != null && Number(item.inheritedGroupProductRate) >= 0)
      return `그룹×제품 ${item.inheritedGroupProductRate}%`;
    return inheritedHint;
  }

  const selectedLens = lenses.find((l) => l.id === selectedLensId);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="mb-1 text-sm font-bold text-gray-900">제품별 수수료율 (매장 오버라이드)</h2>
      <p className="mb-4 text-xs text-gray-500">
        여기서 설정한 값이 해당 제품의 매장 정산율로 우선 적용됩니다(가장 구체적). 미설정 제품은 상속값(그룹×제품 → 매장 전체 → 그룹 전체)이 적용됩니다.
      </p>

      {/* 제품 검색 — 어드민 제품마스터와 동일한 텍스트+칩 필터 */}
      <div className="mb-3 space-y-2 rounded-xl border border-gray-200 bg-gray-50/60 p-3">
        <div className="relative">
          <input
            type="text"
            value={selectedLens ? `${selectedLens.brand} ${selectedLens.name} (${selectedLens.productCode})` : query}
            onChange={(e) => {
              setSelectedLensId('');
              setQuery(e.target.value);
            }}
            placeholder="제품 검색 (브랜드/제품명/코드)"
            className={inputCls}
          />
          {!selectedLensId && filtered.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              {filtered.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLensId(l.id);
                      setQuery('');
                    }}
                    disabled={overriddenIds.has(l.id)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-40"
                  >
                    <span>
                      <span className="font-medium text-gray-900">{l.brand}</span>{' '}
                      <span className="text-gray-700">{l.name}</span>{' '}
                      <span className="text-xs text-gray-500">
                        {cycleLabel(l.replacementCycle)} · {l.piecesPerBox}P
                      </span>{' '}
                      <span className="font-mono text-xs text-gray-400">{l.productCode}</span>
                    </span>
                    {overriddenIds.has(l.id) && (
                      <span className="text-xs text-gray-400">이미 설정됨</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {allBrands.length > 0 && (
          <FilterRow label="브랜드">
            {allBrands.map((b) => (
              <Chip key={b} active={brands.has(b)} onClick={() => toggle(brands, b, setBrands)}>
                {b}
              </Chip>
            ))}
          </FilterRow>
        )}
        {allCycles.length > 0 && (
          <FilterRow label="교체주기">
            {allCycles.map((c) => (
              <Chip key={c} active={cycles.has(c)} onClick={() => toggle(cycles, c, setCycles)}>
                {cycleLabel(c)}
              </Chip>
            ))}
          </FilterRow>
        )}
        {allPacks.length > 0 && (
          <FilterRow label="갯수">
            {allPacks.map((p) => (
              <Chip key={p} active={packs.has(p)} onClick={() => toggle(packs, p, setPacks)}>
                {p}P
              </Chip>
            ))}
          </FilterRow>
        )}
      </div>

      {/* 수수료율 입력 + 저장 */}
      <div className="mb-4 grid gap-2 md:grid-cols-[1fr_140px_auto]">
        <div className="flex items-center text-xs text-gray-500">
          {selectedLens
            ? `선택: ${selectedLens.brand} ${selectedLens.name}`
            : '위에서 제품을 검색·선택하세요'}
        </div>
        <input
          type="number"
          step="0.01"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          placeholder={`상속: ${inheritedHint}`}
          className={inputCls}
        />
        <Button type="button" onClick={save} disabled={busy || !selectedLensId}>
          추가/저장
        </Button>
      </div>
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
                <th className="px-3 py-2 text-right">매장 수수료율</th>
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
                      step="0.01"
                      defaultValue={it.commissionRate}
                      onBlur={async (e) => {
                        const v = e.target.value.trim();
                        if (v === '' || v === it.commissionRate || Number.isNaN(Number(v))) return;
                        setBusy(true);
                        await fetch(`/api/admin/stores/${storeId}/product-commissions`, {
                          method: 'POST',
                          headers: { 'content-type': 'application/json' },
                          body: JSON.stringify({ lensId: it.lensId, commissionRate: v }),
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
