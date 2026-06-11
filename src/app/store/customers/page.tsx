'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface CustomerRow {
  customerId: string;
  name: string;
  phone: string;
  orderCount: number;
  lastOrderAt: string;
}

/**
 * 가맹점 고객 관리 — 자기 매장에 예약(주문) 이력이 있는 고객 검색 (JINY).
 * 상세에서 도수 확인/수정·반품요청·재주문.
 */
export default function StoreCustomersPage() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<CustomerRow[] | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/store/customers?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : { customers: [] }))
        .then((j) => setRows(j.customers ?? []))
        .catch(() => setRows([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold md:text-2xl">고객 관리</h1>
        <p className="mt-1 text-sm text-gray-500">
          우리 매장에서 예약한 고객의 정보·도수를 확인하고 반품요청·재주문을 처리합니다.
        </p>
      </header>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="고객명 또는 전화번호 검색"
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none md:max-w-md"
      />

      {!rows ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-400">
          {q ? '검색 결과가 없습니다.' : '우리 매장 예약 고객이 아직 없습니다.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((c) => (
            <li key={c.customerId}>
              <Link
                href={`/store/customers/${c.customerId}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 transition hover:-translate-y-px hover:shadow-card"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-500">{c.phone}</p>
                </div>
                <div className="shrink-0 text-right text-xs text-gray-500">
                  <p>주문 {c.orderCount}건</p>
                  <p>최근 {new Date(c.lastOrderAt).toLocaleDateString('ko-KR')}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
