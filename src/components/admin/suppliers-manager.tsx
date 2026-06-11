'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { AddressSearchButton } from '@/components/ui/address-search';

interface Supplier {
  id: string;
  name: string;
  bizNo: string | null;
  postalCode: string | null;
  address: string | null;
  addressDetail: string | null;
  contact: string | null;
  phone: string | null;
  memo: string | null;
  isActive: boolean;
}

interface FormState {
  name: string;
  bizNo: string;
  postalCode: string;
  address: string;
  addressDetail: string;
  contact: string;
  phone: string;
  memo: string;
}

const EMPTY: FormState = {
  name: '',
  bizNo: '',
  postalCode: '',
  address: '',
  addressDetail: '',
  contact: '',
  phone: '',
  memo: '',
};

/** 우편번호+기본주소+상세주소를 한 줄 표기 */
function fullAddress(s: Supplier): string {
  const parts = [
    s.postalCode ? `(${s.postalCode})` : '',
    s.address ?? '',
    s.addressDetail ?? '',
  ].filter(Boolean);
  return parts.join(' ').trim();
}

export function SuppliersManager() {
  const [rows, setRows] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // 추가/수정 통합 폼 — editingId 가 있으면 수정 모드
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);

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

  function resetForm() {
    setForm(EMPTY);
    setEditingId(null);
  }

  function startEdit(s: Supplier) {
    setEditingId(s.id);
    setForm({
      name: s.name,
      bizNo: s.bizNo ?? '',
      postalCode: s.postalCode ?? '',
      address: s.address ?? '',
      addressDetail: s.addressDetail ?? '',
      contact: s.contact ?? '',
      phone: s.phone ?? '',
      memo: s.memo ?? '',
    });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function save() {
    if (!form.name.trim()) {
      setMsg('매입처명을 입력하세요');
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = editingId
        ? await fetch(`/api/admin/suppliers/${editingId}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(form),
          })
        : await fetch('/api/admin/suppliers', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(form),
          });
      if (!res.ok) throw new Error();
      setMsg(editingId ? '매입처가 수정되었습니다' : '매입처가 추가되었습니다');
      resetForm();
      await load();
    } catch {
      setMsg(editingId ? '수정 실패' : '추가 실패');
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
      {/* 추가/수정 통합 폼 */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{editingId ? '매입처 수정' : '매입처 추가'}</CardTitle>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="매입처명 *"
              value={form.name}
              placeholder="예: (주)렌즈공급"
              onChange={(e) => set('name', e.target.value)}
            />
            <Input
              label="사업자등록번호"
              value={form.bizNo}
              placeholder="000-00-00000"
              onChange={(e) => set('bizNo', e.target.value)}
            />
          </div>

          {/* 주소 — 고객 회원가입과 동일한 우편번호 검색 폼 */}
          <div className="mt-3">
            <label className="mb-1 block text-sm font-medium text-gray-700">주소</label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={form.postalCode}
                  placeholder="우편번호"
                  readOnly
                  className="h-9 w-32 rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm"
                />
                <AddressSearchButton
                  onComplete={({ zonecode, address }) => {
                    set('postalCode', zonecode);
                    set('address', address);
                  }}
                  className="h-9 shrink-0 rounded-lg border border-gray-300 bg-gray-100 px-3 text-sm font-medium text-gray-700 hover:bg-gray-200"
                />
              </div>
              <input
                type="text"
                value={form.address}
                placeholder="기본주소"
                readOnly
                className="h-9 w-full max-w-2xl rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm"
              />
              <input
                type="text"
                value={form.addressDetail}
                placeholder="나머지 주소(선택 입력 가능)"
                onChange={(e) => set('addressDetail', e.target.value)}
                className="h-9 w-full max-w-2xl rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Input
              label="담당자"
              value={form.contact}
              onChange={(e) => set('contact', e.target.value)}
            />
            <Input
              label="담당자 연락처"
              value={form.phone}
              placeholder="02-000-0000"
              onChange={(e) => set('phone', e.target.value)}
            />
          </div>

          <div className="mt-3">
            <label className="mb-1 block text-sm font-medium text-gray-700">비고</label>
            <textarea
              value={form.memo}
              onChange={(e) => set('memo', e.target.value)}
              rows={4}
              placeholder="결제조건·배송메모·특이사항 등"
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
                    <th className="px-3 py-2 text-left">사업자등록번호</th>
                    <th className="px-3 py-2 text-left">주소</th>
                    <th className="px-3 py-2 text-left">담당자</th>
                    <th className="px-3 py-2 text-left">담당자 연락처</th>
                    <th className="px-3 py-2 text-left">비고</th>
                    <th className="px-3 py-2 text-center">상태</th>
                    <th className="px-3 py-2 text-right">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((s) => (
                    <tr
                      key={s.id}
                      className={`${s.isActive ? '' : 'opacity-50'} ${editingId === s.id ? 'bg-blue-50/40' : ''}`}
                    >
                      <td className="px-3 py-2 font-medium text-gray-900">{s.name}</td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-500">
                        {s.bizNo ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{fullAddress(s) || '—'}</td>
                      <td className="px-3 py-2 text-gray-600">{s.contact ?? '—'}</td>
                      <td className="px-3 py-2 text-gray-600">{s.phone ?? '—'}</td>
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
