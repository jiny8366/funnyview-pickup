import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/current-user';
import { hasPermission } from '@/lib/auth/permissions';
import { fetchPriceHistory } from '@/lib/price-history';
import type { PriceScope } from '@/db/schema';
import { PrintButton } from '@/components/admin/print-button';

export const dynamic = 'force-dynamic';

export default async function PriceHistoryPrintPage({
  searchParams,
}: {
  searchParams: { scope?: string; lensId?: string };
}) {
  const me = await getCurrentUser();
  if (!me) notFound();
  if (!me.isMaster && !hasPermission(me.permissions, 'price_history_view')) {
    notFound();
  }

  const rows = await fetchPriceHistory({
    limit: 5000,
    scope: (searchParams.scope as PriceScope | undefined) ?? undefined,
    lensId: searchParams.lensId ?? undefined,
  });

  return (
    <div className="min-h-screen bg-white p-8 font-sans text-sm text-gray-900 print:p-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <h1 className="text-xl font-bold">가격변동이력 — 인쇄 / PDF</h1>
        <div className="flex gap-2">
          <PrintButton />
          <a
            href="/admin/price-history"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
          >
            ← 목록
          </a>
        </div>
      </div>

      <div className="mb-3 hidden print:block">
        <h1 className="text-xl font-bold">Funnyview Pickup — 가격변동이력</h1>
        <p className="mt-1 text-xs text-gray-600">
          출력 일시: {new Date().toLocaleString('ko-KR')} · 총 {rows.length}건
        </p>
      </div>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b-2 border-gray-900 bg-gray-100">
            <th className="border border-gray-300 px-2 py-1.5 text-left">제품명</th>
            <th className="border border-gray-300 px-2 py-1.5 text-left">제품코드</th>
            <th className="border border-gray-300 px-2 py-1.5 text-left">구분</th>
            <th className="border border-gray-300 px-2 py-1.5 text-left">변경일시</th>
            <th className="border border-gray-300 px-2 py-1.5 text-left">적용시작</th>
            <th className="border border-gray-300 px-2 py-1.5 text-right">이전금액</th>
            <th className="border border-gray-300 px-2 py-1.5 text-right">변동금액</th>
            <th className="border border-gray-300 px-2 py-1.5 text-right">실효가</th>
            <th className="border border-gray-300 px-2 py-1.5 text-left">담당자</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="break-inside-avoid">
              <td className="border border-gray-300 px-2 py-1.5">{r.productName}</td>
              <td className="border border-gray-300 px-2 py-1.5 font-mono text-[10px]">
                {r.productCode}
              </td>
              <td className="border border-gray-300 px-2 py-1.5">{r.scopeLabel}</td>
              <td className="border border-gray-300 px-2 py-1.5 font-mono">
                {new Date(r.createdAt).toLocaleString('ko-KR')}
              </td>
              <td className="border border-gray-300 px-2 py-1.5 font-mono">
                {new Date(r.startsAt).toLocaleDateString('ko-KR')}
              </td>
              <td className="border border-gray-300 px-2 py-1.5 text-right font-mono">
                {r.prevEffective != null ? '₩' + r.prevEffective.toLocaleString() : '—'}
              </td>
              <td className="border border-gray-300 px-2 py-1.5 text-right font-mono">
                {r.delta == null
                  ? '신규'
                  : r.delta > 0
                    ? '+₩' + r.delta.toLocaleString()
                    : r.delta < 0
                      ? '−₩' + Math.abs(r.delta).toLocaleString()
                      : '±0'}
              </td>
              <td className="border border-gray-300 px-2 py-1.5 text-right font-mono font-semibold">
                ₩{r.effective.toLocaleString()}
              </td>
              <td className="border border-gray-300 px-2 py-1.5">{r.createdByLabel}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="border border-gray-300 px-2 py-6 text-center text-gray-400">
                가격 변동 이력이 없습니다
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
