'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { InlineNumberCell } from '@/components/ui/inline-number-cell';

interface Row {
  variantId: string;
  sku: string;
  brand: string;
  lensName: string;
  replacementCycle: string;
  piecesPerBox: number;
  sphere: string;
  cylinder: string | null;
  axis: number | null;
  addPower: string | null;
  onHand: number;
  safetyStock: number;
  sold30d: number;
  recommended: number;
  reorderPoint: number;
  method: 'statistical' | 'simple' | 'none';
}

interface Params {
  serviceZ: number;
  leadTimeDays: number;
  windowDays: number;
}

const CYCLE_LABEL: Record<string, string> = {
  '1day': '원데이', '2week': '2주', '1month': '1개월', '3month': '3개월', '6month': '6개월', '1year': '연간',
};

function doseLabel(r: Row) {
  const parts: string[] = [];
  if (r.sphere) parts.push(`SPH ${Number(r.sphere) > 0 ? '+' : ''}${r.sphere}`);
  if (r.cylinder) parts.push(`CYL ${r.cylinder}`);
  if (r.axis !== null) parts.push(`AX ${r.axis}`);
  if (r.addPower) parts.push(`ADD ${r.addPower}`);
  return parts.join(' ') || '—';
}

/**
 * 안전재고량 관리 (JINY) — 제품 검색/전체 권고 리스트.
 * 현재고 / 안전재고(클릭 편집) / 안전재고 권고수량(판매량 기반, 기준: safety-stock.ts).
 */
export default function SafetyStockPage() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [params, setParams] = useState<Params | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'search' | 'all' | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load(all: boolean) {
    if (!all && !q.trim()) return;
    setLoading(true);
    setMode(all ? 'all' : 'search');
    setErr(null);
    try {
      const sp = all ? 'all=1' : `q=${encodeURIComponent(q.trim())}`;
      const res = await fetch(`/api/admin/safety-stock?${sp}`);
      const j = await res.json();
      setRows(j.rows ?? []);
      setParams(j.params ?? null);
    } catch {
      setErr('조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function saveSafety(variantId: string, value: number) {
    setErr(null);
    const res = await fetch('/api/admin/safety-stock', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ variantId, safetyStock: value }),
    });
    if (!res.ok) {
      setErr('저장에 실패했습니다.');
      return;
    }
    setRows((prev) => prev?.map((r) => (r.variantId === variantId ? { ...r, safetyStock: value } : r)) ?? null);
  }

  // 권고 적용 — 권고수량을 안전재고로 일괄/개별 셋팅
  async function applyAll() {
    if (!rows) return;
    const targets = rows.filter((r) => r.recommended !== r.safetyStock && r.recommended > 0);
    if (targets.length === 0) return;
    if (!window.confirm(`권고수량과 다른 ${targets.length}개 도수의 안전재고를 권고값으로 일괄 적용할까요?`)) return;
    for (const t of targets) {
      // 순차 적용 (행 수 제한적 — 권고>0 대상만)
      await saveSafety(t.variantId, t.recommended);
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold md:text-2xl">안전재고량 관리</h1>
        <p className="mt-1 text-sm text-gray-500">
          최근 판매량을 기반으로 도수별 안전재고를 권고합니다. 안전재고 숫자를 클릭하면 바로 수정됩니다.
        </p>
        {params && (
          <p className="mt-1 text-xs text-gray-400">
            권고 기준: 서비스레벨 95% (Z={params.serviceZ}) · 리드타임 {params.leadTimeDays}일 · 판매 관측 {params.windowDays}일 — SS = Z×σ×√LT
          </p>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white p-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load(false)}
          placeholder="제품명 · 브랜드 · SKU 검색"
          className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none md:max-w-sm"
        />
        <Button size="sm" onClick={() => load(false)} disabled={loading || !q.trim()}>
          {loading && mode === 'search' ? '조회 중…' : '🔍 제품 검색'}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => load(true)} disabled={loading}>
          {loading && mode === 'all' ? '분석 중…' : '📋 전체 품목 안전재고 권고'}
        </Button>
        {rows && rows.some((r) => r.recommended > 0 && r.recommended !== r.safetyStock) && (
          <Button variant="secondary" size="sm" onClick={applyAll}>
            ⚡ 권고값 일괄 적용
          </Button>
        )}
      </div>

      {err && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}

      {!rows ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center text-sm text-gray-400">
          제품을 검색하거나 <b>전체 품목 안전재고 권고</b>를 눌러 시작하세요.
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center text-sm text-gray-400">
          {mode === 'all' ? '판매이력·재고가 있는 도수가 없습니다.' : '검색 결과가 없습니다.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">제품</th>
                <th className="px-3 py-2 text-left">도수</th>
                <th className="px-3 py-2 text-right">최근30일 판매</th>
                <th className="px-3 py-2 text-right">현재고</th>
                <th className="px-3 py-2 text-right">안전재고</th>
                <th className="px-3 py-2 text-right">권고수량</th>
                <th className="px-3 py-2 text-right">적용</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => {
                const low = r.onHand < Math.max(r.safetyStock, r.recommended);
                return (
                  <tr key={r.variantId} className={low ? 'bg-red-50/60' : ''}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900">
                        {r.brand} {r.lensName}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {CYCLE_LABEL[r.replacementCycle] ?? r.replacementCycle} · {r.piecesPerBox}매입 ·{' '}
                        <span className="font-mono">{r.sku}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">{doseLabel(r)}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{r.sold30d}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${low ? 'text-red-700' : ''}`}>{r.onHand}</td>
                    <td className="px-3 py-2 text-right">
                      <InlineNumberCell
                        value={r.safetyStock}
                        canEdit
                        onSave={(n) => saveSafety(r.variantId, n)}
                        title="클릭하여 안전재고 수정"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={r.recommended > 0 ? 'font-semibold text-blue-700' : 'text-gray-400'}>
                        {r.recommended}
                      </span>
                      {r.method === 'simple' && (
                        <span className="ml-1 text-[10px] text-gray-400" title="판매일수가 적어 단순법(평균×리드타임)으로 산출">
                          *
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {r.recommended !== r.safetyStock && r.recommended > 0 && (
                        <button
                          type="button"
                          onClick={() => saveSafety(r.variantId, r.recommended)}
                          className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                        >
                          권고 적용
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows && rows.length > 0 && (
        <p className="text-xs text-gray-400">
          {rows.length.toLocaleString()}개 도수 · 빨간 행 = 현재고가 안전재고(또는 권고) 미만 ·{' '}
          <b>*</b> = 판매일수 부족으로 단순법 산출 (판매 누적 시 통계법으로 자동 전환)
        </p>
      )}
    </div>
  );
}
