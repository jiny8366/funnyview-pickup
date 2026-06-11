'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface Account {
  id: string;
  email: string | null;
  username: string | null;
  name: string | null;
  storeRole?: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

/**
 * 매장 계정 관리 UI (재사용) — store 대표자 화면(안경사만) / admin 매장 화면(대표자+안경사).
 * endpoint: store=/api/store/accounts, admin=/api/admin/stores/{id}/accounts
 * listKey: 응답의 배열 키 (store='opticians', admin='accounts')
 * canSetRole: admin 에서 대표자/안경사 선택 허용.
 */
export function AccountsManager({
  endpoint,
  listKey,
  canSetRole = false,
}: {
  endpoint: string;
  listKey: 'opticians' | 'accounts';
  canSetRole?: boolean;
}) {
  const [items, setItems] = useState<Account[] | null>(null);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', storeRole: 'optician' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(endpoint, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setItems(j[listKey] ?? []);
    } catch {
      setErr('계정 목록을 불러오지 못했습니다');
    }
  }, [endpoint, listKey]);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    setErr('');
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setErr('이름·아이디(이메일)·비밀번호를 모두 입력하세요');
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      };
      if (canSetRole) body.storeRole = form.storeRole;
      const r = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(j.message ?? (j.detail?.fieldErrors ? JSON.stringify(j.detail.fieldErrors) : j.error ?? '등록 실패'));
        return;
      }
      setForm({ name: '', email: '', password: '', storeRole: 'optician' });
      load();
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, p: Record<string, unknown>) {
    const r = await fetch(endpoint, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, ...p }) });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(j.message ?? j.error ?? '변경 실패');
      return;
    }
    load();
  }

  async function resetPw(id: string) {
    const pw = typeof window !== 'undefined' ? window.prompt('새 비밀번호 (8~16자, 영문 대소문/숫자/특수 중 3종 이상)') : '';
    if (!pw) return;
    patch(id, { password: pw });
  }

  const roleLabel = (r?: string | null) => (r === 'owner' ? '대표자' : r === 'optician' ? '담당 안경사' : '—');

  return (
    <div className="space-y-3">
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}

      {/* 목록 */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left">이름</th>
              <th className="px-3 py-2 text-left">아이디(이메일)</th>
              {canSetRole && <th className="px-3 py-2 text-left">구분</th>}
              <th className="px-3 py-2 text-left">상태</th>
              <th className="px-3 py-2 text-right">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items?.map((a) => (
              <tr key={a.id} className={a.isActive ? '' : 'opacity-50'}>
                <td className="px-3 py-2 font-medium">{a.name ?? '—'}</td>
                <td className="px-3 py-2 font-mono text-xs">{a.email ?? a.username}</td>
                {canSetRole && <td className="px-3 py-2 text-xs">{roleLabel(a.storeRole)}</td>}
                <td className="px-3 py-2 text-xs">{a.isActive ? '활성' : '비활성'}</td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-1.5">
                    <Button variant="secondary" size="sm" onClick={() => resetPw(a.id)}>비번재설정</Button>
                    <Button variant="ghost" size="sm" onClick={() => patch(a.id, { isActive: !a.isActive })}>
                      {a.isActive ? '비활성' : '활성화'}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {items && items.length === 0 && (
              <tr><td colSpan={canSetRole ? 5 : 4} className="px-3 py-8 text-center text-gray-400">등록된 계정이 없습니다</td></tr>
            )}
            {!items && (
              <tr><td colSpan={canSetRole ? 5 : 4} className="px-3 py-8 text-center text-gray-400">불러오는 중…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 신규 등록 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-2 text-sm font-semibold">{canSetRole ? '계정 신규 등록' : '담당 안경사 등록'}</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input className="input placeholder:text-gray-300" placeholder="이름 (예: 홍길동)" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <input className="input placeholder:text-gray-300" type="email" autoComplete="off" placeholder="아이디 (이메일)" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <input className="input placeholder:text-gray-300" type="password" autoComplete="new-password" placeholder="비밀번호 (임의 입력)" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          {canSetRole && (
            <select className="input" value={form.storeRole} onChange={(e) => setForm((f) => ({ ...f, storeRole: e.target.value }))}>
              <option value="optician">담당 안경사</option>
              <option value="owner">대표자</option>
            </select>
          )}
        </div>
        <div className="mt-2 flex justify-end">
          <Button onClick={add} disabled={busy}>{busy ? '등록 중…' : '등록'}</Button>
        </div>
      </div>
    </div>
  );
}
