'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { IconEdit } from '@/components/ui/icons';

export interface AccountRow {
  id: string;
  username: string | null;
  phone: string | null;
  email: string | null;
  role: string;
  storeRole: string | null;
  storeId: string | null;
  storeName: string | null;
  storeGroupId: string | null;
  isActive: boolean;
  isMaster: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  admin: '퍼니뷰 관리자',
  warehouse_staff: '픽업관리',
  store_staff: '픽업가맹점',
};

// 드롭다운: 전체(기본) → 픽업업체 / 픽업가맹점 / 어드민 (JINY 지시)
const ROLE_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'warehouse_staff', label: '픽업관리' },
  { value: 'store_staff', label: '픽업가맹점' },
  { value: 'admin', label: '퍼니뷰 관리자' },
];

function roleColor(role: string) {
  switch (role) {
    case 'admin':
      return 'bg-red-50 text-red-700';
    case 'warehouse_staff':
      return 'bg-emerald-50 text-emerald-700';
    case 'store_staff':
      return 'bg-amber-50 text-amber-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

/** 어드민 계정 관리 목록 — 역할 드롭다운 + (픽업가맹점) 그룹선택·상호 부분검색. */
export function StaffAccountsTable({
  rows,
  groups,
}: {
  rows: AccountRow[];
  groups: { id: string; name: string }[];
}) {
  const [role, setRole] = useState('all');
  const [groupId, setGroupId] = useState('all'); // 전체 기본 (JINY 지시)
  const [q, setQ] = useState(''); // 상호 부분검색

  const filtered = useMemo(() => {
    let list = rows;
    if (role !== 'all') list = list.filter((r) => r.role === role);
    if (role === 'store_staff') {
      if (groupId !== 'all') list = list.filter((r) => r.storeGroupId === groupId);
      const needle = q.trim().toLowerCase();
      if (needle) list = list.filter((r) => (r.storeName ?? '').toLowerCase().includes(needle));
    }
    return list;
  }, [rows, role, groupId, q]);

  return (
    <div className="space-y-3">
      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="input w-auto"
          value={role}
          onChange={(e) => { setRole(e.target.value); setGroupId('all'); setQ(''); }}
          aria-label="계정 구분"
        >
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {role === 'store_staff' && (
          <>
            <select
              className="input w-auto"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              aria-label="가맹점 그룹"
            >
              <option value="all">전체 그룹</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <input
              className="input w-56 placeholder:text-gray-300"
              placeholder="상호 일부로 검색 (예: 계룡)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </>
        )}

        <span className="ml-auto text-xs text-gray-400">{filtered.length}개 계정</span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-400">
          조건에 맞는 계정이 없습니다
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <Th>이메일 (로그인 ID)</Th>
                <Th>전화번호</Th>
                <Th>역할</Th>
                <Th>소속 가맹점</Th>
                <Th className="text-center">상태</Th>
                <Th className="text-center">편집</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <Td className="font-mono text-xs">
                    <div className="flex items-center gap-1.5">
                      <Link href={`/admin/staff/${u.id}`} className="text-gray-700 hover:text-brand-600 hover:underline">
                        {u.email ?? u.username ?? '—'}
                      </Link>
                      {u.isMaster && (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700" title="MASTER_USERNAMES 환경변수에 등록된 최상위 권한">
                          🛡 마스터
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td className="font-mono text-xs text-gray-600">{u.phone ?? '—'}</Td>
                  <Td>
                    <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${roleColor(u.role)}`}>
                      {ROLE_LABEL[u.role] ?? u.role}
                      {u.role === 'store_staff' && u.storeRole && (
                        <> · {u.storeRole === 'owner' ? '대표자' : '안경사'}</>
                      )}
                    </span>
                  </Td>
                  <Td className="text-gray-700">{u.storeName ?? '—'}</Td>
                  <Td className="text-center">
                    {u.isActive ? (
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">활성</span>
                    ) : (
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">비활성</span>
                    )}
                  </Td>
                  <Td className="text-center">
                    <Link
                      href={`/admin/staff/${u.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-brand-600"
                    >
                      <IconEdit size={12} /> 편집
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 ${className ?? ''}`}>
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className ?? ''}`}>{children}</td>;
}
