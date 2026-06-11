'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { ProductFilterBar, cycleLabel } from '@/components/product/product-filter-bar';

interface StoreGroup {
  id: string;
  name: string;
  commissionRate: string;
  sortOrder: number;
  memo: string | null;
  memberCount: number;
}

interface StoreRow {
  id: string;
  code: string;
  name: string;
  commissionRate: string;
  groupId: string | null;
  isActive: boolean;
}

interface FormState {
  name: string;
  commissionRate: string;
  sortOrder: string;
  memo: string;
}

interface LensRow {
  id: string;
  brand: string;
  name: string;
  productCode: string;
  replacementCycle: string;
  piecesPerBox: number;
}

interface GroupProductCommission {
  id: string;
  lensId: string;
  commissionRate: string;
  supplyPrice: string | null;
  brand: string;
  name: string;
  productCode: string;
}

const gpcInputCls =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-brand-500 focus:outline-none';

const gpcCycleLabel = cycleLabel;

const EMPTY: FormState = { name: '', commissionRate: '', sortOrder: '0', memo: '' };

export function StoreGroupsManager() {
  const [groups, setGroups] = useState<StoreGroup[]>([]);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 배정 UI 상태
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [assignGroupId, setAssignGroupId] = useState<string>('');

  async function load() {
    setLoading(true);
    try {
      const [gr, sr] = await Promise.all([
        fetch('/api/admin/store-groups').then((r) => r.json()),
        fetch('/api/admin/stores').then((r) => r.json()),
      ]);
      setGroups(gr.groups ?? []);
      setStores(sr.stores ?? []);
    } catch {
      setMsg('불러오기 실패');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const set = (k: keyof FormState, v: string) => setForm((p) => ({ ...p, [k]: v }));

  function resetForm() {
    setForm(EMPTY);
    setEditingId(null);
  }

  function startEdit(g: StoreGroup) {
    setEditingId(g.id);
    setForm({
      name: g.name,
      commissionRate: g.commissionRate ?? '',
      sortOrder: String(g.sortOrder ?? 0),
      memo: g.memo ?? '',
    });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function save() {
    if (!form.name.trim()) {
      setMsg('그룹명을 입력하세요');
      return;
    }
    setSaving(true);
    setMsg(null);
    const payload = {
      name: form.name.trim(),
      commissionRate: form.commissionRate.trim() === '' ? '0' : form.commissionRate.trim(),
      sortOrder: Number(form.sortOrder) || 0,
      memo: form.memo.trim(),
    };
    try {
      const res = editingId
        ? await fetch(`/api/admin/store-groups/${editingId}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/admin/store-groups', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          });
      if (!res.ok) throw new Error();
      setMsg(editingId ? '그룹이 수정되었습니다' : '그룹이 추가되었습니다');
      resetForm();
      await load();
    } catch {
      setMsg(editingId ? '수정 실패' : '추가 실패');
    } finally {
      setSaving(false);
    }
  }

  async function removeGroup(id: string) {
    if (typeof window !== 'undefined' && !window.confirm('이 그룹을 삭제할까요? 소속 매장은 그룹이 해제됩니다.')) {
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/store-groups/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setMsg('그룹이 삭제되었습니다');
      if (editingId === id) resetForm();
      await load();
    } catch {
      setMsg('삭제 실패');
    } finally {
      setSaving(false);
    }
  }

  const checkedIds = useMemo(
    () => Object.keys(checked).filter((k) => checked[k]),
    [checked],
  );

  // JINY 확정 UX: 미배정 리스트(포함하면 사라짐) / 선택 그룹의 소속 리스트(선택해 제외)
  const unassigned = useMemo(() => stores.filter((s) => !s.groupId), [stores]);
  const members = useMemo(
    () => (assignGroupId ? stores.filter((s) => s.groupId === assignGroupId) : []),
    [stores, assignGroupId],
  );

  async function assignIds(ids: string[], groupId: string | null) {
    if (ids.length === 0) {
      setMsg('매장을 선택하세요');
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/stores', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ storeIds: ids, groupId }),
      });
      if (!res.ok) throw new Error();
      setMsg(
        groupId
          ? `${ids.length}개 매장을 그룹에 포함했습니다`
          : `${ids.length}개 매장을 그룹에서 제외했습니다`,
      );
      setChecked({});
      await load();
    } catch {
      setMsg('배정 실패');
    } finally {
      setSaving(false);
    }
  }

  const checkedIn = (list: StoreRow[]) => list.filter((s) => checked[s.id]).map((s) => s.id);

  function toggleAllIn(list: StoreRow[]) {
    const all = list.length > 0 && list.every((s) => checked[s.id]);
    setChecked((p) => {
      const next = { ...p };
      for (const s of list) next[s.id] = !all;
      return next;
    });
  }

  return (
    <div className="space-y-5">
      {/* 그룹 추가/수정 폼 */}
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? '그룹 수정' : '그룹 추가'}</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="그룹명 *"
              value={form.name}
              placeholder="예: 강남권 직영"
              onChange={(e) => set('name', e.target.value)}
            />
            <Input
              label="그룹 수수료율 (%)"
              type="number"
              step="0.01"
              value={form.commissionRate}
              placeholder="0"
              onChange={(e) => set('commissionRate', e.target.value)}
            />
            <Input
              label="정렬순서"
              type="number"
              value={form.sortOrder}
              onChange={(e) => set('sortOrder', e.target.value)}
            />
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-sm font-medium text-gray-700">비고</label>
            <textarea
              value={form.memo}
              onChange={(e) => set('memo', e.target.value)}
              rows={3}
              placeholder="그룹 운영 메모"
              className="w-full max-w-2xl rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Button onClick={save} disabled={saving}>
              {saving ? '처리 중…' : editingId ? '수정 저장' : '추가'}
            </Button>
            {editingId && (
              <Button variant="secondary" onClick={resetForm} disabled={saving}>
                취소
              </Button>
            )}
            {msg && <p className="text-sm text-gray-600">{msg}</p>}
          </div>
        </CardBody>
      </Card>

      {/* 제품별 수수료율 (그룹 × 제품) — 그룹 수정 모드에서만 노출 */}
      {editingId && (
        <GroupProductCommissions
          groupId={editingId}
          groupName={groups.find((g) => g.id === editingId)?.name ?? ''}
          groupOverallRate={groups.find((g) => g.id === editingId)?.commissionRate ?? '0'}
        />
      )}

      {/* 그룹 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>그룹 목록 ({groups.length})</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {loading ? (
            <p className="px-4 py-6 text-sm text-gray-500">불러오는 중…</p>
          ) : groups.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-500">등록된 그룹이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">그룹명</th>
                    <th className="px-3 py-2 text-right">수수료율</th>
                    <th className="px-3 py-2 text-right">소속 매장수</th>
                    <th className="px-3 py-2 text-left">비고</th>
                    <th className="px-3 py-2 text-right">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {groups.map((g) => (
                    <tr key={g.id} className={editingId === g.id ? 'bg-blue-50/40' : ''}>
                      <td className="px-3 py-2 font-medium text-gray-900">{g.name}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{g.commissionRate}%</td>
                      <td className="px-3 py-2 text-right text-gray-700">{g.memberCount}</td>
                      <td className="px-3 py-2 text-gray-600">{g.memo ?? '—'}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="secondary" onClick={() => startEdit(g)}>
                            편집
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => removeGroup(g.id)}
                            disabled={saving}
                          >
                            삭제
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* 그룹 배정 — ①미배정 리스트(포함하면 사라짐) ②선택 그룹 소속 리스트(선택해 제외) */}
      <Card>
        <CardHeader>
          <CardTitle>그룹 배정</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600">대상 그룹</span>
            <select
              value={assignGroupId}
              onChange={(e) => {
                setAssignGroupId(e.target.value);
                setChecked({});
              }}
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-100"
            >
              <option value="">그룹 선택…</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.memberCount})
                </option>
              ))}
            </select>
            {msg && <p className="text-sm text-gray-600">{msg}</p>}
          </div>

          {loading ? (
            <p className="px-1 py-4 text-sm text-gray-500">불러오는 중…</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {/* 미배정 가맹점 — 포함하면 이 리스트에서 사라짐 */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-800">
                    그룹 미배정 가맹점 ({unassigned.length})
                  </h3>
                  <Button
                    size="sm"
                    onClick={() => assignIds(checkedIn(unassigned), assignGroupId)}
                    disabled={saving || !assignGroupId || checkedIn(unassigned).length === 0}
                  >
                    선택 {checkedIn(unassigned).length}개 → 그룹에 포함
                  </Button>
                </div>
                <StoreCheckTable
                  list={unassigned}
                  checked={checked}
                  setChecked={setChecked}
                  onToggleAll={() => toggleAllIn(unassigned)}
                  emptyText="미배정 가맹점이 없습니다 — 전부 그룹에 소속되어 있습니다."
                />
              </div>

              {/* 선택 그룹 소속 가맹점 — 선택해 제외 */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-800">
                    {assignGroupId
                      ? `'${groups.find((g) => g.id === assignGroupId)?.name ?? ''}' 소속 가맹점 (${members.length})`
                      : '소속 가맹점 — 그룹을 선택하세요'}
                  </h3>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => assignIds(checkedIn(members), null)}
                    disabled={saving || !assignGroupId || checkedIn(members).length === 0}
                  >
                    선택 {checkedIn(members).length}개 → 그룹에서 제외
                  </Button>
                </div>
                {assignGroupId ? (
                  <StoreCheckTable
                    list={members}
                    checked={checked}
                    setChecked={setChecked}
                    onToggleAll={() => toggleAllIn(members)}
                    emptyText="이 그룹에 소속된 가맹점이 없습니다."
                  />
                ) : (
                  <p className="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-400">
                    위에서 그룹을 선택하면 소속 가맹점이 표시됩니다.
                  </p>
                )}
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/** 체크박스 가맹점 테이블 — 미배정/소속 리스트 공용. */
function StoreCheckTable({
  list,
  checked,
  setChecked,
  onToggleAll,
  emptyText,
}: {
  list: StoreRow[];
  checked: Record<string, boolean>;
  setChecked: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onToggleAll: () => void;
  emptyText: string;
}) {
  if (list.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-400">
        {emptyText}
      </p>
    );
  }
  const all = list.every((s) => checked[s.id]);
  return (
    <div className="max-h-80 overflow-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500">
          <tr>
            <th className="px-3 py-2 text-left">
              <input type="checkbox" checked={all} onChange={onToggleAll} />
            </th>
            <th className="px-3 py-2 text-left">가맹점명</th>
            <th className="px-3 py-2 text-left">코드</th>
            <th className="px-3 py-2 text-right">자체 수수료율</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {list.map((s) => (
            <tr
              key={s.id}
              className={`${s.isActive ? '' : 'opacity-50'} ${checked[s.id] ? 'bg-blue-50/40' : ''}`}
            >
              <td className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={!!checked[s.id]}
                  onChange={(e) => setChecked((p) => ({ ...p, [s.id]: e.target.checked }))}
                />
              </td>
              <td className="px-3 py-2 font-medium text-gray-900">{s.name}</td>
              <td className="px-3 py-2 font-mono text-xs text-gray-500">{s.code}</td>
              <td className="px-3 py-2 text-right text-gray-700">
                {s.commissionRate && Number(s.commissionRate) > 0 ? `${s.commissionRate}%` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 그룹 × 제품 수수료율 오버라이드 섹션 (그룹 수정 시 노출). */
function GroupProductCommissions({
  groupId,
  groupName,
  groupOverallRate,
}: {
  groupId: string;
  groupName: string;
  groupOverallRate: string;
}) {
  const [items, setItems] = useState<GroupProductCommission[]>([]);
  const [lenses, setLenses] = useState<LensRow[]>([]);
  const [query, setQuery] = useState('');
  const [brands, setBrands] = useState<Set<string>>(new Set());
  const [cycles, setCycles] = useState<Set<string>>(new Set());
  const [packs, setPacks] = useState<Set<number>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [supplyPrice, setSupplyPrice] = useState('');
  const [discountRate, setDiscountRate] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    try {
      const [cr, lr] = await Promise.all([
        fetch(`/api/admin/store-groups/${groupId}/product-commissions`).then((r) => r.json()),
        fetch('/api/admin/lenses').then((r) => r.json()),
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
    } catch {
      setMsg('불러오기 실패');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const overriddenIds = useMemo(() => new Set(items.map((i) => i.lensId)), [items]);
  const lensById = useMemo(() => new Map(lenses.map((l) => [l.id, l])), [lenses]);

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

  function toggleChip<T>(set: Set<T>, val: T, setter: (s: Set<T>) => void) {
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
      if (allFilteredSelected) filtered.forEach((l) => s.delete(l.id));
      else filtered.forEach((l) => s.add(l.id));
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
      const res = await fetch(`/api/admin/store-groups/${groupId}/product-commissions`, {
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
    if (typeof window !== 'undefined' && !window.confirm('이 제품 오버라이드를 삭제할까요?')) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(
        `/api/admin/store-groups/${groupId}/product-commissions?lensId=${encodeURIComponent(lensId)}`,
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>제품별 공급가·할인율 — {groupName || '그룹'}</CardTitle>
      </CardHeader>
      <CardBody>
        <p className="mb-4 text-xs text-gray-500">
          그룹 전체율({groupOverallRate}%)보다 우선하는 제품별 그룹 공급가/할인율입니다. 매장 × 제품 오버라이드가 있으면 그쪽이 더 우선합니다. 정산은 공급가 우선(있으면 공급가, 없으면 할인율).
        </p>

        {/* 검색 + 칩 필터 — 공용 ProductFilterBar */}
        <div className="mb-3">
          <ProductFilterBar
            facets={{ brands: allBrands, cycles: allCycles, packs: allPacks }}
            values={{ query, brands, cycles, packs }}
            onQuery={setQuery}
            onToggleBrand={(b) => toggleChip(brands, b, setBrands)}
            onToggleCycle={(c) => toggleChip(cycles, c, setCycles)}
            onTogglePack={(p) => toggleChip(packs, p, setPacks)}
            showType={false}
            searchPlaceholder="제품 검색 (브랜드/제품명/코드)"
          />
        </div>

        {/* 검색 결과 리스트 */}
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
                        {gpcCycleLabel(l.replacementCycle)} · {l.piecesPerBox}P
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

        {/* 선택한 제품 */}
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
              className={gpcInputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">가맹점 할인율 (%)</label>
            <input
              type="number"
              step="0.01"
              value={discountRate}
              onChange={(e) => setDiscountRate(e.target.value)}
              placeholder="수수료율 %"
              className={gpcInputCls}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={save} disabled={busy || selectedIds.size === 0}>
              저장
            </Button>
          </div>
        </div>
        <p className="mb-3 text-xs text-gray-400">공급가/할인율 중 최소 하나 입력. 선택한 모든 제품에 동일 적용됩니다.</p>
        {msg && <p className="mb-3 text-sm text-gray-600">{msg}</p>}

        {items.length === 0 ? (
          <p className="px-1 py-4 text-sm text-gray-500">설정된 제품별 수수료율이 없습니다.</p>
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
                          await fetch(
                            `/api/admin/store-groups/${groupId}/product-commissions`,
                            {
                              method: 'POST',
                              headers: { 'content-type': 'application/json' },
                              body: JSON.stringify({ lensId: it.lensId, supplyPrice: v === '' ? null : v }),
                            },
                          );
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
                          await fetch(
                            `/api/admin/store-groups/${groupId}/product-commissions`,
                            {
                              method: 'POST',
                              headers: { 'content-type': 'application/json' },
                              body: JSON.stringify({ lensId: it.lensId, discountRate: v }),
                            },
                          );
                          setBusy(false);
                          await load();
                        }}
                        className="w-24 rounded border border-gray-200 px-2 py-1 text-right text-sm focus:border-brand-500 focus:outline-none"
                      />
                      <span className="ml-1 text-gray-400">%</span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button size="sm" variant="danger" onClick={() => remove(it.lensId)} disabled={busy}>
                        삭제
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
