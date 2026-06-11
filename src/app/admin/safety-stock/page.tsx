'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { InlineNumberCell } from '@/components/ui/inline-number-cell';
import { ProductFilterBar } from '@/components/product/product-filter-bar';

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

interface ProductHit {
  id: string;
  brand: string;
  name: string;
  replacementCycle: string;
  piecesPerBox: number;
  variantCount: number;
}

interface Params {
  serviceZ: number;
  leadTimeDays: number;
  windowDays: number;
}

const CYCLE_LABEL: Record<string, string> = {
  '1day': '원데이', '2week': '2주', '1month': '1개월', '3month': '3개월', '6month': '6개월', '1year': '연간',
};

const TYPE_OPTIONS = [
  { value: 'spherical', label: '구면(투명)' },
  { value: 'toric', label: '난시(토릭)' },
  { value: 'multifocal', label: '멀티포컬' },
  { value: 'color', label: '컬러' },
];

function toggleInSet<T>(set: Set<T>, val: T, setter: (s: Set<T>) => void) {
  const s = new Set(set);
  if (s.has(val)) s.delete(val);
  else s.add(val);
  setter(s);
}

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
  const [brands, setBrands] = useState<Set<string>>(new Set());
  const [types, setTypes] = useState<Set<string>>(new Set());
  const [cycles, setCycles] = useState<Set<string>>(new Set());
  const [packs, setPacks] = useState<Set<number>>(new Set());
  const [allBrands, setAllBrands] = useState<string[]>([]);
  const [allCycles, setAllCycles] = useState<string[]>([]);
  const [allPacks, setAllPacks] = useState<number[]>([]);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [params, setParams] = useState<Params | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'search' | 'all' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  // 필터 칩 facet — 다른 화면과 동일한 표준 검색
  useEffect(() => {
    fetch('/api/admin/safety-stock?facets=1')
      .then((r) => r.json())
      .then((j) => {
        setAllBrands(j.brands ?? []);
        setAllCycles(j.cycles ?? []);
        setAllPacks(j.packs ?? []);
      })
      .catch(() => {});
  }, []);

  const hasFilter = Boolean(q.trim() || brands.size || types.size || cycles.size || packs.size);

  // 검색 → 제품명 리스트 → 선택 → 하단 도수 리스트 (JINY)
  const [products, setProducts] = useState<ProductHit[] | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductHit | null>(null);

  async function load(all: boolean) {
    if (!all && !hasFilter) return;
    setLoading(true);
    setMode(all ? 'all' : 'search');
    setErr(null);
    try {
      if (all) {
        setProducts(null);
        setSelectedProduct(null);
        const res = await fetch('/api/admin/safety-stock?all=1');
        const j = await res.json();
        setRows(j.rows ?? []);
        setParams(j.params ?? null);
      } else {
        // 1단계: 제품명 리스트
        const sp = new URLSearchParams({ products: '1' });
        if (q.trim()) sp.set('q', q.trim());
        if (brands.size > 0) sp.set('brand', [...brands].join(','));
        if (types.size > 0) sp.set('type', [...types].join(','));
        if (cycles.size > 0) sp.set('cycle', [...cycles].join(','));
        if (packs.size > 0) sp.set('pack', [...packs].join(','));
        const res = await fetch('/api/admin/purchasing?' + sp.toString());
        const j = await res.json();
        setProducts(j.products ?? []);
        setSelectedProduct(null);
        setRows(null);
        if ((j.products ?? []).length === 0) setErr('검색 결과가 없습니다.');
      }
    } catch {
      setErr('조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  // 2단계: 제품 선택 → '전체 품목 권고'와 동일한 본문 리스트로 도수 표시 (JINY)
  async function selectProduct(p: ProductHit) {
    setSelectedProduct(p);
    setLoading(true);
    setMode('search');
    setErr(null);
    try {
      const res = await fetch(`/api/admin/safety-stock?lensId=${p.id}`);
      const j = await res.json();
      setRows(j.rows ?? []);
      setParams(j.params ?? null);
    } catch {
      setErr('도수 조회에 실패했습니다.');
      setSelectedProduct(null);
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

      <div className="space-y-2 rounded-2xl border border-gray-200 bg-white p-3">
        {/* 검색 + 브랜드/타입/주기/갯수 칩 — 공용 ProductFilterBar (표준 검색, JINY) */}
        <ProductFilterBar
          className="space-y-2"
          facets={{ brands: allBrands, types: TYPE_OPTIONS, cycles: allCycles, packs: allPacks }}
          values={{ query: q, brands, types, cycles, packs }}
          onQuery={setQ}
          onToggleBrand={(b) => toggleInSet(brands, b, setBrands)}
          onToggleType={(t) => toggleInSet(types, t, setTypes)}
          onToggleCycle={(c) => toggleInSet(cycles, c, setCycles)}
          onTogglePack={(p) => toggleInSet(packs, p, setPacks)}
          searchPlaceholder="제품명 · 브랜드 · SKU 검색"
        />
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button size="sm" onClick={() => load(false)} disabled={loading || !hasFilter}>
            {loading && mode === 'search' ? '조회 중…' : '🔍 조회'}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => load(true)} disabled={loading}>
            {loading && mode === 'all' ? '분석 중…' : '📋 전체 품목 안전재고 권고'}
          </Button>
          {rows && rows.some((r) => r.recommended > 0 && r.recommended !== r.safetyStock) && (
            <Button variant="secondary" size="sm" onClick={applyAll}>
              ⚡ 권고값 일괄 적용
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => setUploadOpen(true)}>
            📤 과거 판매데이터 업로드
          </Button>
        </div>
      </div>

      {uploadOpen && <SalesUploadModal onClose={() => setUploadOpen(false)} />}

      {err && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}

      {/* 1단계: 제품명 리스트 — 선택하면 하단에 도수 리스트 (JINY) */}
      {products && products.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">제품</th>
                <th className="px-3 py-2 text-left">주기 · 팩</th>
                <th className="px-3 py-2 text-right">도수 수</th>
                <th className="px-3 py-2 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => selectProduct(p)}
                  className={`cursor-pointer ${selectedProduct?.id === p.id ? 'bg-amber-50/70' : 'hover:bg-gray-50'}`}
                >
                  <td className="px-3 py-2 font-medium text-gray-900">{p.brand} {p.name}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {CYCLE_LABEL[p.replacementCycle] ?? p.replacementCycle} · {p.piecesPerBox}P
                  </td>
                  <td className="px-3 py-2 text-right text-gray-600">{p.variantCount}</td>
                  <td className="px-3 py-2 text-right text-xs text-amber-700">
                    {selectedProduct?.id === p.id ? '선택됨 ▾' : '도수 보기 ›'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedProduct && rows && (
        <p className="text-xs text-gray-500">
          ▾ <b>{selectedProduct.brand} {selectedProduct.name}</b> 의 도수별 리스트 — 전체 품목 권고와 동일한 관리 방식
        </p>
      )}

      {!rows ? (
        products ? null : (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center text-sm text-gray-400">
            제품을 검색하거나 <b>전체 품목 안전재고 권고</b>를 눌러 시작하세요.
          </div>
        )
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

/** 간단 CSV 파서 — 따옴표·이스케이프("") 지원 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQ = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQ) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

/**
 * 과거 판매데이터 업로드 모달 (JINY) — 샘플양식(CSV·엑셀 호환) 다운로드,
 * 파일 업로드 → 서버 검수(제품명·도수 매칭, 수량·날짜 형식) → 유효 행만 참조데이터 저장.
 */
function SalesUploadModal({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ inserted: number; errorCount: number; errors: { row: number; reason: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ rows: number; qty: number; from: string | null; to: string | null } | null>(null);

  useEffect(() => {
    fetch('/api/admin/safety-stock/sales-upload')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setSummary(j?.summary ?? null))
      .catch(() => {});
  }, []);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const text = await file.text();
      const table = parseCsv(text);
      if (table.length < 2) {
        setError('데이터 행이 없습니다. 샘플양식을 참고해 주세요.');
        return;
      }
      // 헤더 검사 (순서 고정: 제품명, SPH, CYL, AXIS, ADD, 수량, 판매일)
      const header = table[0].map((h) => h.trim());
      if (!header[0]?.includes('제품명') || !header[5]?.includes('수량') || !header[6]?.includes('판매일')) {
        setError('양식이 다릅니다 — 샘플양식(제품명/SPH/CYL/AXIS/ADD/수량/판매일)을 사용해 주세요.');
        return;
      }
      const rows = table.slice(1).map((r) => ({
        productName: (r[0] ?? '').trim(),
        sphere: (r[1] ?? '').trim() || null,
        cylinder: (r[2] ?? '').trim() || null,
        axis: (r[3] ?? '').trim() || null,
        addPower: (r[4] ?? '').trim() || null,
        quantity: (r[5] ?? '').trim(),
        soldOn: (r[6] ?? '').trim(),
      }));
      if (rows.length > 5000) {
        setError('한 번에 최대 5,000행까지 업로드할 수 있습니다. 파일을 나눠 주세요.');
        return;
      }
      const res = await fetch('/api/admin/safety-stock/sales-upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.message ?? j.error ?? '업로드에 실패했습니다.');
        return;
      }
      setResult(j);
    } catch {
      setError('파일을 읽지 못했습니다. CSV(엑셀에서 다른 이름으로 저장 → CSV) 형식인지 확인해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">과거 판매데이터 업로드</h2>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-gray-400 hover:bg-gray-100">✕</button>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-gray-500">
          시스템 도입 전 판매 이력을 올리면 안전재고 권고의 참조데이터로 활용됩니다.
          샘플양식에 <b>제품명 · 도수(SPH/CYL/AXIS/ADD) · 수량 · 판매일</b>을 채워 CSV로 저장 후 업로드하세요.
          검수를 통과한 행만 저장되고, 오류 행은 사유와 함께 표시됩니다.
        </p>
        {summary && summary.rows > 0 && (
          <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
            현재 참조데이터: {summary.rows.toLocaleString()}행 · 총 {summary.qty.toLocaleString()}개 ({summary.from} ~ {summary.to})
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <a
            href="/api/admin/safety-stock/sales-upload?template=1"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            ⬇ 샘플양식 다운로드 (CSV)
          </a>
          <label className="cursor-pointer rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black">
            {busy ? '검수 중…' : '📤 파일 선택·업로드'}
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = '';
              }}
            />
          </label>
        </div>

        {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        {result && (
          <div className="mt-3 space-y-2">
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              ✅ {result.inserted.toLocaleString()}행 저장 완료
              {result.errorCount > 0 && ` · 오류 ${result.errorCount}행 (저장 안 됨)`}
            </p>
            {result.errors.length > 0 && (
              <div className="max-h-44 overflow-y-auto rounded-xl border border-red-100 bg-red-50/50 p-2 text-xs text-red-700">
                {result.errors.map((e2, i) => (
                  <p key={i}>
                    {e2.row}행: {e2.reason}
                  </p>
                ))}
                {result.errorCount > result.errors.length && (
                  <p className="text-red-400">… 외 {result.errorCount - result.errors.length}건</p>
                )}
              </div>
            )}
            <p className="text-[11px] text-gray-400">
              ※ 같은 파일을 다시 올리면 중복 저장됩니다. 수정 재업로드 시 오류 행만 골라 올려주세요.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
