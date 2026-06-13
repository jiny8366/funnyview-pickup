'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatKRW } from '@/lib/utils/format';

interface StoreRow {
  storeId: string;
  storeName: string;
  commissionRate: string | null;
  orderCount: number;
  netRevenue: number;
  commission: number;
}
interface SettlementData {
  days: number;
  kpi: { orderCount: number; completedCount: number; grossRevenue: number; avgOrder: number; cogs: number; grossProfit: number };
  stores: StoreRow[];
}

/**
 * 가맹점별 정산 / 매출 리포트 — 기간별 매출·원가·영업이익 + 가맹점별 순매출·수수료(지급액).
 * 데이터는 /api/admin/dashboard(완료주문 기준 집계) 재사용. CSV 내보내기 제공.
 * ※ 공급가 기준 순매출·공급마진 정합(JINY 확정)은 M3 정산 소스와 연동되는 별도 고도화 항목.
 */
export function SettlementClient() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<SettlementData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    setData(null);
    setLoadError(false);
    fetch(`/api/admin/dashboard?days=${days}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch(() => setLoadError(true));
  }, [days]);

  const view = useMemo(() => {
    if (!data) return [];
    const t = q.trim().toLowerCase();
    const list = t ? data.stores.filter((s) => s.storeName.toLowerCase().includes(t)) : data.stores;
    return list;
  }, [data, q]);

  const totals = useMemo(
    () =>
      view.reduce(
        (a, s) => ({ orderCount: a.orderCount + s.orderCount, netRevenue: a.netRevenue + s.netRevenue, commission: a.commission + s.commission }),
        { orderCount: 0, netRevenue: 0, commission: 0 },
      ),
    [view],
  );

  function exportCsv() {
    if (!data) return;
    const header = ['가맹점', '주문수', '순매출', '수수료율(%)', '지급액(수수료)'];
    const lines = view.map((s) => [s.storeName, s.orderCount, s.netRevenue, s.commissionRate ?? '0', s.commission]);
    const csv = [header, ...lines, ['합계', totals.orderCount, totals.netRevenue, '', totals.commission]]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `정산_최근${days}일.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-sm text-gray-500">
        <span>정산 데이터를 불러오지 못했습니다.</span>
        <button type="button" onClick={() => setDays((d) => d)} className="rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 hover:bg-gray-50">다시 시도</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-9 rounded-lg border border-gray-300 px-2 text-sm">
          <option value={7}>최근 7일</option>
          <option value={14}>최근 14일</option>
          <option value={30}>최근 30일</option>
          <option value={90}>최근 90일</option>
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="가맹점명 검색" className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm sm:w-56" />
        <button type="button" onClick={exportCsv} disabled={!data} className="ml-auto h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">⬇ 엑셀(CSV)</button>
      </div>

      {/* 매출 KPI */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="총매출(완료)" value={data ? formatKRW(data.kpi.grossRevenue) : '…'} />
        <Kpi label="원가(FIFO)" value={data ? formatKRW(data.kpi.cogs) : '…'} />
        <Kpi label="영업이익" value={data ? formatKRW(data.kpi.grossProfit) : '…'} accent />
        <Kpi label="완료 주문" value={data ? `${data.kpi.completedCount.toLocaleString()}건` : '…'} />
      </section>

      {/* 가맹점별 정산 */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="whitespace-nowrap px-4 py-2.5 text-left">가맹점</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-right">주문수</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-right">순매출</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-right">수수료율</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-right">지급액(수수료)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {!data ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">불러오는 중…</td></tr>
            ) : view.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">정산 대상 가맹점이 없습니다</td></tr>
            ) : (
              view.map((s) => (
                <tr key={s.storeId} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">{s.storeName}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-gray-600">{s.orderCount}건</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">{formatKRW(s.netRevenue)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-gray-500">{s.commissionRate ?? '0'}%</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-brand-700">{formatKRW(s.commission)}</td>
                </tr>
              ))
            )}
          </tbody>
          {data && view.length > 0 && (
            <tfoot className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
              <tr>
                <td className="px-4 py-3 text-gray-700">합계 ({view.length}곳)</td>
                <td className="px-4 py-3 text-right">{totals.orderCount}건</td>
                <td className="px-4 py-3 text-right">{formatKRW(totals.netRevenue)}</td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-right text-brand-700">{formatKRW(totals.commission)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="px-1 text-[11px] text-gray-400">※ 순매출·영업이익은 완료주문 기준 집계입니다. 공급가 기준 순매출·공급마진 정합은 정산 소스 연동 후 반영 예정.</p>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`mt-1 text-xl font-bold ${accent ? 'text-brand-700' : ''}`}>{value}</div>
    </div>
  );
}
