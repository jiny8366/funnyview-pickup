'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';

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

  async function assign(groupId: string | null) {
    if (checkedIds.length === 0) {
      setMsg('매장을 선택하세요');
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/stores', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ storeIds: checkedIds, groupId }),
      });
      if (!res.ok) throw new Error();
      setMsg(
        groupId
          ? `${checkedIds.length}개 매장을 그룹에 포함했습니다`
          : `${checkedIds.length}개 매장의 그룹을 해제했습니다`,
      );
      setChecked({});
      await load();
    } catch {
      setMsg('배정 실패');
    } finally {
      setSaving(false);
    }
  }

  const groupName = (id: string | null) =>
    id ? (groups.find((g) => g.id === id)?.name ?? '—') : '—';

  const allChecked = stores.length > 0 && stores.every((s) => checked[s.id]);
  function toggleAll() {
    if (allChecked) {
      setChecked({});
    } else {
      const next: Record<string, boolean> = {};
      for (const s of stores) next[s.id] = true;
      setChecked(next);
    }
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
                            수정
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

      {/* 그룹 배정 — 가맹점 리스트에서 선택 */}
      <Card>
        <CardHeader>
          <CardTitle>그룹 배정 (가맹점 선택)</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <select
              value={assignGroupId}
              onChange={(e) => setAssignGroupId(e.target.value)}
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-100"
            >
              <option value="">그룹 선택…</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              onClick={() => assign(assignGroupId)}
              disabled={saving || !assignGroupId || checkedIds.length === 0}
            >
              그룹에 포함
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => assign(null)}
              disabled={saving || checkedIds.length === 0}
            >
              그룹 해제
            </Button>
            <span className="text-sm text-gray-500">선택 {checkedIds.length}개</span>
          </div>

          {loading ? (
            <p className="px-1 py-4 text-sm text-gray-500">불러오는 중…</p>
          ) : stores.length === 0 ? (
            <p className="px-1 py-4 text-sm text-gray-500">등록된 가맹점이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">
                      <input type="checkbox" checked={allChecked} onChange={toggleAll} />
                    </th>
                    <th className="px-3 py-2 text-left">가맹점명</th>
                    <th className="px-3 py-2 text-left">코드</th>
                    <th className="px-3 py-2 text-right">자체 수수료율</th>
                    <th className="px-3 py-2 text-left">현재 그룹</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stores.map((s) => (
                    <tr key={s.id} className={`${s.isActive ? '' : 'opacity-50'} ${checked[s.id] ? 'bg-blue-50/40' : ''}`}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={!!checked[s.id]}
                          onChange={(e) =>
                            setChecked((p) => ({ ...p, [s.id]: e.target.checked }))
                          }
                        />
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-900">{s.name}</td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-500">{s.code}</td>
                      <td className="px-3 py-2 text-right text-gray-700">
                        {s.commissionRate && Number(s.commissionRate) > 0 ? `${s.commissionRate}%` : '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{groupName(s.groupId)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
