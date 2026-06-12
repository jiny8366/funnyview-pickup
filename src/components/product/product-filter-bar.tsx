'use client';

import React from 'react';
import { CYCLE_LABEL, cycleLabel } from '@/lib/lens/format';

// 교체주기 라벨은 단일 표준 소스에서 재export (기존 importer 호환 유지, 드리프트 방지)
export { CYCLE_LABEL, cycleLabel };

export interface ProductFilterFacets {
  brands: string[];
  /** 렌즈타입 (value/label). 없으면 타입 행 미표시. */
  types?: { value: string; label: string }[];
  cycles?: string[];
  packs?: number[];
}

export interface ProductFilterValues {
  query: string;
  brands: Set<string>;
  types?: Set<string>;
  cycles?: Set<string>;
  packs?: Set<number>;
}

export interface ProductFilterBarProps {
  facets: ProductFilterFacets;
  values: ProductFilterValues;
  onQuery: (v: string) => void;
  onToggleBrand: (b: string) => void;
  onToggleType?: (t: string) => void;
  onToggleCycle?: (c: string) => void;
  onTogglePack?: (p: number) => void;
  onReset?: () => void;
  /** 행 표시 여부 (기본 전부 true). 해당 facet이 비어 있으면 자동으로 숨김. */
  showType?: boolean;
  showCycle?: boolean;
  showPack?: boolean;
  searchPlaceholder?: string;
  /**
   * 활성 칩/포커스 색상 스킴. 페이지별 톤 유지용.
   * 'brand'(기본, 어드민) | 'amber'(가맹점 발주).
   */
  accent?: 'brand' | 'amber';
  /** 브랜드 라벨 변환(예: 한글명 → 영문명). 미지정 시 원본 표시. */
  brandLabel?: (brand: string) => string;
  /** 외곽 컨테이너 className 오버라이드. */
  className?: string;
}

type Accent = 'brand' | 'amber';

const ACCENT_CHIP: Record<Accent, string> = {
  brand: 'bg-brand-600 text-white',
  amber: 'bg-amber-600 text-white',
};
const ACCENT_FOCUS: Record<Accent, string> = {
  brand: 'focus:border-brand-500',
  amber: 'focus:border-amber-500',
};

/**
 * 제품 검색/필터 공용 UI (controlled / presentational).
 *
 * 렌더링: 검색 input + 브랜드/렌즈타입/교체주기/갯수 칩 행 (+ 선택적 초기화).
 * 활성(active)·가격·정렬 필터는 렌더하지 않음 — 그건 페이지별(어드민) 컨트롤.
 * 데이터/필터링 로직은 각 페이지가 보유; 이 컴포넌트는 표시·이벤트만 담당.
 */
export function ProductFilterBar({
  facets,
  values,
  onQuery,
  onToggleBrand,
  onToggleType,
  onToggleCycle,
  onTogglePack,
  onReset,
  showType = true,
  showCycle = true,
  showPack = true,
  searchPlaceholder = '브랜드, 제품명, 코드로 검색',
  accent = 'brand',
  brandLabel,
  className,
}: ProductFilterBarProps) {
  const chipActive = ACCENT_CHIP[accent];
  const brandTxt = brandLabel ?? ((b: string) => b);

  const types = facets.types ?? [];
  const cycles = facets.cycles ?? [];
  const packs = facets.packs ?? [];

  return (
    <div
      className={
        className ??
        'space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3'
      }
    >
      <input
        type="text"
        value={values.query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder={searchPlaceholder}
        className={`w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none ${ACCENT_FOCUS[accent]}`}
      />

      {facets.brands.length > 0 && (
        <FilterRow label="브랜드">
          {facets.brands.map((b) => (
            <Chip
              key={b}
              active={values.brands.has(b)}
              activeCls={chipActive}
              onClick={() => onToggleBrand(b)}
            >
              {brandTxt(b)}
            </Chip>
          ))}
        </FilterRow>
      )}

      {showType && types.length > 0 && onToggleType && (
        <FilterRow label="렌즈 타입">
          {types.map((t) => (
            <Chip
              key={t.value}
              active={!!values.types?.has(t.value)}
              activeCls={chipActive}
              onClick={() => onToggleType(t.value)}
            >
              {t.label}
            </Chip>
          ))}
        </FilterRow>
      )}

      {showCycle && cycles.length > 0 && onToggleCycle && (
        <FilterRow label="교체주기">
          {cycles.map((c) => (
            <Chip
              key={c}
              active={!!values.cycles?.has(c)}
              activeCls={chipActive}
              onClick={() => onToggleCycle(c)}
            >
              {cycleLabel(c)}
            </Chip>
          ))}
        </FilterRow>
      )}

      {showPack && packs.length > 0 && onTogglePack && (
        <FilterRow label="갯수">
          {packs.map((p) => (
            <Chip
              key={p}
              active={!!values.packs?.has(p)}
              activeCls={chipActive}
              onClick={() => onTogglePack(p)}
            >
              {p}P
            </Chip>
          ))}
        </FilterRow>
      )}

      {onReset && (
        <div className="flex justify-end pt-0.5">
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-gray-500 hover:text-gray-900"
          >
            필터 초기화
          </button>
        </div>
      )}
    </div>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-16 shrink-0 pt-1 text-xs font-medium text-gray-600">
        {label}
      </div>
      <div className="flex flex-1 flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  active,
  activeCls,
  onClick,
  children,
}: {
  active: boolean;
  activeCls: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`press rounded-full px-2.5 py-1 text-xs transition ${
        active ? activeCls : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );
}
