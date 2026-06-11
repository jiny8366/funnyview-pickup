'use client';

import { useMemo, useState } from 'react';

export interface PowerCell {
  sphere: number;
  cylinder: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** '적용' 시 호출 — 선택된 사각형 안의 모든 셀 (sphere, cyl) */
  onApply: (cells: PowerCell[]) => void;
  /** 난시 렌즈가 아니면 cylinder=0 한 열만. true 면 cyl 축 활성화. */
  enableCylinder?: boolean;
  /** 사용자가 '설정' 으로 지정한 난시 도수 범위 (없으면 default). */
  cylinderRange?: number[]; // 예: [0, -0.25, -0.5, ..., -2.75]
  /** 기존 선택을 모달에 prefill. */
  initial?: PowerCell[];
}

const STEP = 0.25;
const SPHERE_MIN = -20;
const SPHERE_MAX = 4;
const CYL_MIN = -6;
const CYL_MAX = 1;

const SPHERE_ROWS: number[] = (() => {
  const arr: number[] = [];
  for (let s = SPHERE_MAX; s >= SPHERE_MIN - 1e-6; s -= STEP) {
    arr.push(Math.round(s * 100) / 100);
  }
  return arr;
})();

const CYL_COLS_FULL: number[] = (() => {
  const arr: number[] = [];
  for (let c = CYL_MAX; c >= CYL_MIN - 1e-6; c -= STEP) {
    arr.push(Math.round(c * 100) / 100);
  }
  return arr;
})();

/**
 * 파워챠트 모달 — 사용자 요구 (확정 2026-05-19):
 *  - 좌상단 = sphere 0.00, cylinder 0.00
 *  - 단위 0.25, 기본 부호 (-)
 *  - 우측으로 cyl (-) 증가 / 좌측으로 (+) 부호 전환
 *  - 아래로 sphere (-) 증가 / 위로 (+) 부호 전환
 *  - hover 시 가로/세로 안내선 highlight
 *  - 셀 클릭 = 시작 → 다시 클릭 = 끝 → 사각형 범위 선택
 *  - '적용' → 그 사각형 안의 모든 셀 적용
 */
export function PowerChartModal({
  open,
  onClose,
  onApply,
  enableCylinder,
  cylinderRange,
}: Props) {
  // cylinder cols
  const cylCols = useMemo(() => {
    if (cylinderRange && cylinderRange.length > 0) return cylinderRange;
    if (!enableCylinder) return [0];
    return CYL_COLS_FULL;
  }, [cylinderRange, enableCylinder]);

  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const [start, setStart] = useState<{ r: number; c: number } | null>(null);
  const [end, setEnd] = useState<{ r: number; c: number } | null>(null);

  const selection = useMemo(() => {
    if (!start) return null;
    const r1 = Math.min(start.r, (end ?? start).r);
    const r2 = Math.max(start.r, (end ?? start).r);
    const c1 = Math.min(start.c, (end ?? start).c);
    const c2 = Math.max(start.c, (end ?? start).c);
    return { r1, r2, c1, c2 };
  }, [start, end]);

  const selectedCells: PowerCell[] = useMemo(() => {
    if (!selection) return [];
    const cells: PowerCell[] = [];
    for (let r = selection.r1; r <= selection.r2; r++) {
      for (let c = selection.c1; c <= selection.c2; c++) {
        cells.push({ sphere: SPHERE_ROWS[r], cylinder: cylCols[c] });
      }
    }
    return cells;
  }, [selection, cylCols]);

  if (!open) return null;

  function onCellClick(r: number, c: number) {
    if (!start || (start && end)) {
      // 새 선택 시작
      setStart({ r, c });
      setEnd(null);
    } else {
      setEnd({ r, c });
    }
  }

  function isCellSelected(r: number, c: number): boolean {
    if (!selection) return false;
    return r >= selection.r1 && r <= selection.r2 && c >= selection.c1 && c <= selection.c2;
  }

  function isInGuide(r: number, c: number): boolean {
    if (!hover) return false;
    return hover.r === r || hover.c === c;
  }

  function fmt(n: number): string {
    const sign = n > 0 ? '+' : n < 0 ? '−' : '';
    return `${sign}${Math.abs(n).toFixed(2)}`;
  }

  function clear() {
    setStart(null);
    setEnd(null);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-5xl animate-scale-in flex-col overflow-hidden rounded-2xl bg-white shadow-pop">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">파워챠트</h2>
            <p className="mt-0.5 text-[11px] text-gray-500">
              좌상단 0.00 · 단위 0.25D · 우측/아래 (−) · 좌측/위 (+){' '}
              {enableCylinder ? '· 가로 cyl × 세로 sphere' : '· 구면 only (cyl 사용 안 함)'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
            aria-label="닫기"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* 상태 표시 */}
        <div className="flex items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-5 py-2 text-xs">
          <div className="font-mono text-gray-700">
            {selection ? (
              <>
                <span className="font-semibold">선택:</span> SPH {fmt(SPHERE_ROWS[selection.r2])} ~{' '}
                {fmt(SPHERE_ROWS[selection.r1])}
                {enableCylinder && (
                  <>
                    {' · '}CYL {fmt(cylCols[selection.c1])} ~ {fmt(cylCols[selection.c2])}
                  </>
                )}
                <span className="ml-2 text-gray-400">({selectedCells.length} 개)</span>
              </>
            ) : (
              <span className="text-gray-400">셀을 클릭해 시작점 선택 → 다시 클릭해 끝점 선택</span>
            )}
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={clear}
              className="rounded border border-gray-300 bg-white px-2 py-0.5 text-[11px] text-gray-600 hover:bg-gray-50"
            >
              초기화
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto p-4">
          <table className="border-collapse">
            <thead className="sticky top-0 z-10 bg-white">
              <tr>
                <th className="sticky left-0 z-20 bg-white px-2 py-1 text-[10px] text-gray-400">
                  SPH \ CYL
                </th>
                {cylCols.map((cyl, c) => (
                  <th
                    key={c}
                    className={`min-w-[44px] border-b border-gray-200 px-1 py-1 text-[10px] font-medium ${
                      hover?.c === c ? 'bg-amber-100 text-amber-800' : 'text-gray-600'
                    }`}
                  >
                    {fmt(cyl)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SPHERE_ROWS.map((sph, r) => (
                <tr key={r}>
                  <th
                    className={`sticky left-0 z-10 border-r border-gray-200 bg-white px-2 py-0.5 text-right text-[10px] font-medium ${
                      hover?.r === r ? 'bg-amber-100 text-amber-800' : 'text-gray-600'
                    }`}
                  >
                    {fmt(sph)}
                  </th>
                  {cylCols.map((cyl, c) => {
                    const inGuide = isInGuide(r, c);
                    const selected = isCellSelected(r, c);
                    return (
                      <td
                        key={c}
                        onMouseEnter={() => setHover({ r, c })}
                        onMouseLeave={() => setHover(null)}
                        onClick={() => onCellClick(r, c)}
                        className={`h-6 cursor-pointer border border-gray-100 text-center text-[10px] transition ${
                          selected
                            ? 'bg-brand-500 text-white'
                            : inGuide
                              ? 'bg-amber-50'
                              : 'bg-white hover:bg-gray-50'
                        }`}
                        title={`SPH ${fmt(sph)} CYL ${fmt(cyl)}`}
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
          >
            취소
          </button>
          <button
            type="button"
            disabled={selectedCells.length === 0}
            onClick={() => {
              onApply(selectedCells);
              clear();
              onClose();
            }}
            className="rounded-lg bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
          >
            적용 ({selectedCells.length})
          </button>
        </div>
      </div>
    </div>
  );
}
