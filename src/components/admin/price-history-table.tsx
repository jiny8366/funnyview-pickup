'use client';

import { useEffect, useState } from 'react';

interface Row {
  id: string;
  productName: string;
  productCode: string;
  scopeLabel: string;
  effective: number;
  prevEffective: number | null;
  delta: number | null;
  startsAt: string;
  endsAt: string | null;
  createdAt: string;
  createdByLabel: string;
}

interface Props {
  canDelete: boolean;
}

export function PriceHistoryTable({ canDelete }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<string>('');

  async function refresh() {
    setLoading(true);
    try {
      const q = scope ? `?scope=${scope}` : '';
      const res = await fetch(`/api/admin/price-history${q}`, { cache: 'no-store' });
      if (res.ok) {
        const body = await res.json();
        setRows(body.rows ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  async function onDelete(id: string) {
    if (!canDelete) return;
    if (!window.confirm('이 가격 변동 기록을 삭제합니다. 계속하시겠어요?')) return;
    const res = await fetch(`/api/admin/price-history/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      window.alert(body.error ?? '삭제 실패');
      return;
    }
    refresh();
  }

  function downloadCsv() {
    const q = scope ? `?scope=${scope}` : '';
    window.location.href = `/api/admin/price-history/export${q}`;
  }

  function openPrint() {
    const q = scope ? `?scope=${scope}` : '';
    window.open(`/admin/price-history/print${q}`, '_blank');
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs">
          <label className="text-gray-600">구분 필터:</label>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="h-8 rounded border border-gray-300 px-2 text-xs"
          >
            <option value="">전체</option>
            <option value="purchase">매입</option>
            <option value="supply">공급</option>
            <option value="retail">소비자</option>
          </select>
          <span className="text-gray-400">총 {rows.length}건</span>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={openPrint}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            🖨 미리보기 / PDF
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            📥 엑셀 (CSV)
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th>제품명</Th>
              <Th>구분</Th>
              <Th>변경일시</Th>
              <Th>적용시작</Th>
              <Th>이전금액</Th>
              <Th>변동금액</Th>
              <Th>실효가</Th>
              <Th>담당자</Th>
              {canDelete && <Th className="text-right">액션</Th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={canDelete ? 9 : 8} className="px-3 py-6 text-center text-xs text-gray-400">
                  불러오는 중…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={canDelete ? 9 : 8} className="px-3 py-6 text-center text-xs text-gray-400">
                  가격 변동 이력이 없습니다
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <Td>
                    <div className="text-gray-900">{r.productName}</div>
                    <div className="font-mono text-[10px] text-gray-400">{r.productCode}</div>
                  </Td>
                  <Td>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${scopeColor(r.scopeLabel)}`}>
                      {r.scopeLabel}
                    </span>
                  </Td>
                  <Td className="font-mono text-xs text-gray-600">{fmtDate(r.createdAt)}</Td>
                  <Td className="font-mono text-xs text-gray-500">{fmtDate(r.startsAt)}</Td>
                  <Td className="text-right font-mono text-xs text-gray-500">
                    {r.prevEffective != null ? '₩' + r.prevEffective.toLocaleString() : '—'}
                  </Td>
                  <Td className="text-right font-mono text-xs">
                    {r.delta == null ? (
                      <span className="text-gray-400">신규</span>
                    ) : r.delta > 0 ? (
                      <span className="font-semibold text-red-600">+₩{r.delta.toLocaleString()}</span>
                    ) : r.delta < 0 ? (
                      <span className="font-semibold text-blue-600">−₩{Math.abs(r.delta).toLocaleString()}</span>
                    ) : (
                      <span className="text-gray-400">±0</span>
                    )}
                  </Td>
                  <Td className="text-right font-mono text-xs font-semibold text-gray-900">
                    ₩{r.effective.toLocaleString()}
                  </Td>
                  <Td className="text-xs text-gray-600">{r.createdByLabel}</Td>
                  {canDelete && (
                    <Td className="text-right">
                      <button
                        type="button"
                        onClick={() => onDelete(r.id)}
                        className="rounded border border-red-200 bg-white px-2 py-1 text-[10px] font-medium text-red-600 hover:bg-red-50"
                      >
                        삭제
                      </button>
                    </Td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function scopeColor(label: string): string {
  switch (label) {
    case '매입':
      return 'bg-amber-50 text-amber-700';
    case '공급':
      return 'bg-emerald-50 text-emerald-700';
    case '소비자':
      return 'bg-brand-50 text-brand-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 ${
        className ?? ''
      }`}
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className ?? ''}`}>{children}</td>;
}
