'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';

interface Supplier {
  id: string;
  name: string;
  contact: string | null;
  phone: string | null;
  bizNo: string | null;
  memo: string | null;
  isActive: boolean;
}

interface FormState {
  name: string;
  contact: string;
  phone: string;
  bizNo: string;
  memo: string;
}

const EMPTY: FormState = { name: '', contact: '', phone: '', bizNo: '', memo: '' };

export function SuppliersManager() {
  const [rows, setRows] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // 추가 폼
  const [form, setForm] = useState<FormState>(EMPTY);

  // 편집 중 행
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/suppliers?all=1');
      const d = await r.json();
      setRows(d.suppliers ?? []);
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
  const setEdit = (k: keyof FormState, v: string) =>
    setEditForm((p) => ({ ...p, [k]: v }));

  async function create() {
    if (!form.name.trim()) {
      setMsg('매입처명을 입력하세요');
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/suppliers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      setForm(EMPTY);
      setMsg('매입처가 추가되었습니다');
      await load();
    } catch {
      setMsg('추가 실패');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(s: Supplier) {
    setEditingId(s.id);
    setEditForm({
      name: s.name,
      contact: s.contact ?? '',
      phone: s.phone ?? '',
      bizNo: s.bizNo ?? '',
      memo: s.memo ?? '',
    });
  }

  async function saveEdit(id: string) {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/suppliers/${id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error();
      setEditingId(null);
      await load();
    } catch {
      setMsg('수정 실패');
    } finally {
      setSaving(false);
    }
  }

  async function setActive(id: string, isActive: boolean) {
    setSaving(true);
    setMsg(null);
    try {
      if (isActive) {
        await fetch(`/api/admin/suppliers/${id}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ isActive: true }),
        });
      } else {
        await fetch(`/api/admin/suppliers/${id}`, { method: 'DELETE' });
      }
      await load();
    } catch {
      setMsg('상태 변경 실패');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* 추가 폼 */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>매입처 추가</CardTitle>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              label="매입처명 *"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="예: (주)렌즈공급"
            />
            <Input
              label="담당자"
              value={form.contact}
              onChange={(e) => set('contact', e.target.value)}
            />
            <Input
              label="연락처"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="02-000-0000"
            />
            <Input
              label="사업자등록번호"
              value={form.bizNo}
              onChange={(e) => set('bizNo', e.target.value)}
              placeholder="000-00-00000"
            />
            <Input
              label="메모"
              value={form.memo}
              onChange={(e) => set('memo', e.target.value)}
            />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Button onClick={create} disabled={saving}>
              {saving ? '처리 중…' : '추가'}
            </Button>
            {msg && <p className="text-sm text-gray-600">{msg}</p>}
          </div>
        </CardBody>
      </Card>

      {/* 목록 */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>등록된 매입처 ({rows.length})</CardTitle>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {loading ? (
            <p className="px-4 py-6 text-sm text-gray-500">불러오는 중…</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-500">등록된 매입처가 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">매입처명</th>
                    <th className="px-3 py-2 text-left">담당자</th>
                    <th className="px-3 py-2 text-left">연락처</th>
                    <th className="px-3 py-2 text-left">사업자번호</th>
                    <th className="px-3 py-2 text-left">메모</th>
                    <th className="px-3 py-2 text-center">상태</th>
                    <th className="px-3 py-2 text-right">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((s) =>
                    editingId === s.id ? (
                      <tr key={s.id} className="bg-blue-50/40">
                        <td className="px-3 py-2">
                          <input
                            value={editForm.name}
                            onChange={(e) => setEdit('name', e.target.value)}
                            className="input h-8"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={editForm.contact}
                            onChange={(e) => setEdit('contact', e.target.value)}
                            className="input h-8"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={editForm.phone}
                            onChange={(e) => setEdit('phone', e.target.value)}
                            className="input h-8"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={editForm.bizNo}
                            onChange={(e) => setEdit('bizNo', e.target.value)}
                            className="input h-8"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={editForm.memo}
                            onChange={(e) => setEdit('memo', e.target.value)}
                            className="input h-8"
                          />
                        </td>
                        <td className="px-3 py-2 text-center text-xs text-gray-500">
                          {s.isActive ? '활성' : '비활성'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button size="sm" onClick={() => saveEdit(s.id)} disabled={saving}>
                              저장
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setEditingId(null)}
                            >
                              취소
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={s.id} className={s.isActive ? '' : 'opacity-50'}>
                        <td className="px-3 py-2 font-medium text-gray-900">{s.name}</td>
                        <td className="px-3 py-2 text-gray-600">{s.contact ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-600">{s.phone ?? '—'}</td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-500">
                          {s.bizNo ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-gray-600">{s.memo ?? '—'}</td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                              s.isActive
                                ? 'bg-green-50 text-green-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {s.isActive ? '활성' : '비활성'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button size="sm" variant="secondary" onClick={() => startEdit(s)}>
                              수정
                            </Button>
                            {s.isActive ? (
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => setActive(s.id, false)}
                                disabled={saving}
                              >
                                비활성
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setActive(s.id, true)}
                                disabled={saving}
                              >
                                활성화
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
