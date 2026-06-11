'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export interface StoreRow {
  id: string;
  name: string;
  addressLine1: string | null;
  phone: string | null;
  commissionRate: string | null;
  isActive: boolean;
  groupName: string | null;
}

type SortKey = 'name' | 'group' | 'commission' | 'status';

/**
 * 가맹점 목록 테이블 — 동급 섹션(제품·고객)과 동일하게 검색 + 정렬 제공.
 * 소속 그룹을 컬럼으로 노출해 매장마다 상세로 들어가지 않아도 한눈에 확인.
 */
export function StoresTable({ rows }: { rows: StoreRow[] }) {
  const [q, setQ] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const view = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = rows;
    if (term) {
      list = rows.filter(
        (s) =>
          s.name.toLowerCase().includes(term) ||
          (s.phone ?? '').toLowerCase().includes(term) ||
          (s.addressLine1 ?? '').toLowerCase().includes(term) ||
          (s.groupName ?? '').toLowerCase().includes(term),
      );
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    const sorted = [...list].sort((a, b) => {
      switch (sortKey) {
        case 'commission':
          return (Number(a.commissionRate ?? 0) - Number(b.commissionRate ?? 0)) * dir;
        case 'status':
          return (Number(a.isActive) - Number(b.isActive)) * dir;
        case 'group':
          return (a.groupName ?? '').localeCompare(b.groupName ?? '', 'ko') * dir;
        default:
          return a.name.localeCompare(b.name, 'ko') * dir;
      }
    });
    return sorted;
  }, [rows, q, sortKey, sortDir]);

  const arrow = (key: SortKey) => (sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="가맹점명 · 전화 · 주소 · 그룹 검색"
          className="h-9 w-72 rounded-lg border border-gray-200 px-3 text-sm"
        />
        <span className="text-xs text-gray-500">
          {view.length.toLocaleString()} / {rows.length.toLocaleString()}곳
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th sortable onClick={() => toggleSort('name')}>이름{arrow('name')}</Th>
              <Th>주소</Th>
              <Th>전화</Th>
              <Th sortable onClick={() => toggleSort('group')}>소속 그룹{arrow('group')}</Th>
              <Th sortable className="text-right" onClick={() => toggleSort('commission')}>수수료율{arrow('commission')}</Th>
              <Th sortable className="text-center" onClick={() => toggleSort('status')}>상태{arrow('status')}</Th>
              <Th className="text-right">관리</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {view.length === 0 ? (
              <tr>
                <Td className="text-center text-gray-400" colSpan={7}>
                  검색 결과가 없습니다
                </Td>
              </tr>
            ) : (
              view.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <Td className="font-medium text-gray-900">
                    <Link href={`/admin/stores/${s.id}`} className="hover:text-brand-700 hover:underline">
                      {s.name}
                    </Link>
                  </Td>
                  <Td className="text-gray-600">{s.addressLine1 ?? '—'}</Td>
                  <Td className="font-mono text-xs text-gray-600">{s.phone ?? '—'}</Td>
                  <Td className="text-gray-600">
                    {s.groupName ? (
                      <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700">
                        {s.groupName}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </Td>
                  <Td className="text-right text-gray-700">
                    {s.commissionRate ? `${s.commissionRate}%` : '—'}
                  </Td>
                  <Td className="text-center">
                    {s.isActive ? (
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        활성
                      </span>
                    ) : (
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">비활성</span>
                    )}
                  </Td>
                  <Td className="text-right">
                    <Link href={`/admin/stores/${s.id}`}>
                      <Button size="sm" variant="secondary">
                        편집
                      </Button>
                    </Link>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({
  children,
  className,
  sortable,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  sortable?: boolean;
  onClick?: () => void;
}) {
  return (
    <th
      onClick={onClick}
      className={`px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 ${
        sortable ? 'cursor-pointer select-none hover:text-gray-800' : ''
      } ${className ?? ''}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
  colSpan,
}: {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={`px-4 py-3 ${className ?? ''}`}>
      {children}
    </td>
  );
}
