'use client';

import { useEffect, useState } from 'react';
import { ImagePicker } from '@/components/admin/image-picker';
import { Input } from '@/components/ui/input';
import type { SectionKind } from '@/lib/home/section-config';

interface FieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}

function Field({ label, hint, children }: FieldProps) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-gray-700">{label}</div>
      <div className="mt-1">{children}</div>
      {hint && <div className="mt-1 text-[10px] text-gray-400">{hint}</div>}
    </label>
  );
}

function TextField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

function TextArea({
  value,
  onChange,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className="w-full rounded-lg border border-gray-300 p-2 text-sm"
    />
  );
}

function ColorField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value || '#000000'}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-12 cursor-pointer rounded border"
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#000000"
        className="font-mono text-xs"
      />
    </div>
  );
}

function SelectField<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="h-10 w-full rounded-lg border border-gray-300 px-2 text-sm"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function NumberField({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <Input
      type="number"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

// ─────────────────────────────────────────────────────
// 공통 props
// ─────────────────────────────────────────────────────
export interface SectionEditorProps {
  kind: SectionKind;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

export function SectionEditor(props: SectionEditorProps) {
  switch (props.kind) {
    case 'hero':
      return <HeroEditor {...props} />;
    case 'product_grid':
      return <ProductGridEditor {...props} />;
    case 'category_chips':
      return <CategoryChipsEditor {...props} />;
    case 'banner_strip':
      return <BannerStripEditor {...props} />;
    case 'countdown':
      return <CountdownEditor {...props} />;
    case 'brand_story':
      return <BrandStoryEditor {...props} />;
  }
}

// ─────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────
function HeroEditor({ config, onChange }: SectionEditorProps) {
  const c = config as Record<string, string | undefined>;
  function patch(k: string, v: string | undefined) {
    onChange({ ...config, [k]: v });
  }
  return (
    <div className="space-y-3">
      <Field label="헤드라인">
        <TextField value={c.headline ?? ''} onChange={(v) => patch('headline', v)} />
      </Field>
      <Field label="서브라인">
        <TextField value={c.subline ?? ''} onChange={(v) => patch('subline', v)} />
      </Field>
      <Field label="이미지" hint="업로드 또는 URL 직접 입력 — 비디오와 둘 다 있으면 비디오 우선">
        <ImagePicker
          value={c.imageUrl ?? ''}
          onChange={(v) => patch('imageUrl', v)}
          folder="home-hero"
        />
      </Field>
      <Field label="비디오 URL (선택)">
        <TextField value={c.videoUrl ?? ''} onChange={(v) => patch('videoUrl', v)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="배경 색상">
          <ColorField value={c.bgColor ?? '#2563eb'} onChange={(v) => patch('bgColor', v)} />
        </Field>
        <Field label="글자 색상">
          <ColorField value={c.textColor ?? '#ffffff'} onChange={(v) => patch('textColor', v)} />
        </Field>
      </div>
      <Field label="정렬">
        <SelectField
          value={(c.align as 'left' | 'center') ?? 'left'}
          options={[
            { value: 'left', label: '왼쪽 정렬' },
            { value: 'center', label: '가운데 정렬' },
          ]}
          onChange={(v) => patch('align', v)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="CTA 버튼 라벨">
          <TextField value={c.ctaLabel ?? ''} onChange={(v) => patch('ctaLabel', v)} />
        </Field>
        <Field label="CTA 링크">
          <TextField value={c.ctaHref ?? ''} onChange={(v) => patch('ctaHref', v)} placeholder="/customer/order" />
        </Field>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// Product Grid
// ─────────────────────────────────────────────────────
const LENS_TYPE_LABEL: Record<string, string> = {
  spherical: '일반',
  toric: '난시',
  multifocal: '다초점',
  color: '컬러',
  circle: '써클',
};
const CYCLE_LABEL: Record<string, string> = {
  '1day': '원데이',
  '2week': '2주',
  '1month': '1개월',
  '3month': '3개월',
  '6month': '6개월',
  '1year': '1년',
};

interface LensListItem {
  id: string;
  brand: string;
  name: string;
  lensType: string;
  replacementCycle: string;
}

function ProductGridEditor({ config, onChange }: SectionEditorProps) {
  const c = config as Record<string, unknown>;
  const [lensList, setLensList] = useState<LensListItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    // admin 포털 미들웨어는 /api/lenses 를 차단 → admin 전용 /api/admin/lenses 사용
    fetch('/api/admin/lenses')
      .then((r) => (r.ok ? r.json() : { lenses: [] }))
      .then((j) => {
        const items = (j.lenses ?? []) as Array<{
          id: string;
          brand: string;
          name: string;
          lensType: string;
          replacementCycle: string;
          isActive?: boolean;
        }>;
        setLensList(
          items
            .filter((l) => l.isActive !== false)
            .map((l) => ({
              id: l.id,
              brand: l.brand,
              name: l.name,
              lensType: l.lensType,
              replacementCycle: l.replacementCycle,
            })),
        );
      })
      .catch(() => setLensList([]));
  }, []);

  function patch(k: string, v: unknown) {
    onChange({ ...config, [k]: v });
  }

  const lensIds = (c.lensIds as string[]) ?? [];
  const mode = (c.mode as string) ?? 'best';
  const layout = (c.layout as 'grid' | 'carousel') ?? 'grid';

  const selectedLenses = lensIds
    .map((id) => lensList.find((l) => l.id === id))
    .filter((l): l is LensListItem => Boolean(l));

  return (
    <div className="space-y-4">
      <Field label="큐레이션 모드">
        <SelectField
          value={mode}
          options={[
            { value: 'best', label: '베스트 (총 주문량 기준 — 자동)' },
            { value: 'trending', label: '트렌딩 (최근 7일 주문량 — 자동)' },
            { value: 'new', label: '신상품 (등록일 최신순 — 자동)' },
            { value: 'manual', label: '수동 선택 (운영자가 직접 지정)' },
          ]}
          onChange={(v) => patch('mode', v)}
        />
      </Field>

      {/* 진열 제품 — 모드와 무관하게 항상 노출. 수동 모드면 source-of-truth, 자동 모드면 override */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-gray-700">
            진열 제품{' '}
            {mode === 'manual' ? (
              <span className="text-brand-600">({lensIds.length}종 직접 지정)</span>
            ) : (
              <span className="text-gray-400">
                ({lensIds.length}종 직접 지정 — 모드 {'‘'}수동 선택{'’'} 시 적용)
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-brand-700"
          >
            🛍️ 제품 선택 / 변경
          </button>
        </div>

        {selectedLenses.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-4 text-center text-[11px] text-gray-400">
            아직 직접 지정한 제품이 없습니다.{' '}
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="text-brand-600 underline hover:no-underline"
            >
              제품 선택하기 →
            </button>
          </div>
        ) : (
          <ol className="space-y-1">
            {selectedLenses.map((l, idx) => (
              <li
                key={l.id}
                className="flex items-center gap-2 rounded border border-gray-100 bg-white px-2 py-1 text-xs"
              >
                <span className="w-5 text-center text-[10px] font-mono text-gray-400">
                  {idx + 1}
                </span>
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                  {l.brand}
                </span>
                <span className="flex-1 truncate">{l.name}</span>
                <span className="text-[10px] text-gray-400">
                  {LENS_TYPE_LABEL[l.lensType] ?? l.lensType}
                  {' · '}
                  {CYCLE_LABEL[l.replacementCycle] ?? l.replacementCycle}
                </span>
              </li>
            ))}
          </ol>
        )}

        {mode !== 'manual' && lensIds.length > 0 && (
          <div className="rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-700">
            ⓘ 현재 모드는{' '}
            <strong>
              {mode === 'best' ? '베스트(자동)' : mode === 'trending' ? '트렌딩(자동)' : '신상품(자동)'}
            </strong>{' '}
            입니다. 직접 지정한 제품을 표시하려면{' '}
            <button
              type="button"
              onClick={() => patch('mode', 'manual')}
              className="font-semibold text-amber-800 underline hover:no-underline"
            >
              수동 선택 모드로 전환
            </button>
            하세요.
          </div>
        )}
      </div>

      {pickerOpen && (
        <ProductPickerDialog
          lensList={lensList}
          selectedIds={lensIds}
          onClose={() => setPickerOpen(false)}
          onSave={(ids) => {
            patch('lensIds', ids);
            // 처음 제품을 선택하면 자동으로 manual 모드로 전환
            if (ids.length > 0 && mode !== 'manual') {
              onChange({ ...config, lensIds: ids, mode: 'manual' });
            }
            setPickerOpen(false);
          }}
        />
      )}

      <div className="grid grid-cols-3 gap-3">
        <Field label="표시 개수">
          <NumberField value={(c.limit as number) ?? 4} onChange={(v) => patch('limit', v)} min={1} max={12} />
        </Field>
        <Field label="레이아웃">
          <SelectField
            value={layout}
            options={[
              { value: 'grid', label: '그리드' },
              { value: 'carousel', label: '슬라이드 (가로)' },
            ]}
            onChange={(v) => patch('layout', v)}
          />
        </Field>
        <Field label="가격 표시">
          <SelectField
            value={c.showPrice === false ? 'no' : 'yes'}
            options={[
              { value: 'yes', label: '표시' },
              { value: 'no', label: '숨김' },
            ]}
            onChange={(v) => patch('showPrice', v === 'yes')}
          />
        </Field>
      </div>

      {/* 슬라이드 옵션 — layout=carousel 일 때만 노출 */}
      {layout === 'carousel' && (
        <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-3 space-y-3">
          <div className="text-xs font-semibold text-brand-700">슬라이드 설정</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="자동 이동" hint="끄면 클릭/스와이프로만 이동">
              <SelectField
                value={c.autoplay === true ? 'on' : 'off'}
                options={[
                  { value: 'off', label: '꺼짐' },
                  { value: 'on', label: '켜짐' },
                ]}
                onChange={(v) => patch('autoplay', v === 'on')}
              />
            </Field>
            <Field label="이동 간격 (초)" hint="자동 이동이 켜졌을 때">
              <NumberField
                value={(c.autoplaySeconds as number) ?? 5}
                onChange={(v) => patch('autoplaySeconds', Math.max(2, v))}
                min={2}
                max={30}
              />
            </Field>
            <Field label="좌/우 화살표">
              <SelectField
                value={c.showArrows === false ? 'no' : 'yes'}
                options={[
                  { value: 'yes', label: '표시' },
                  { value: 'no', label: '숨김' },
                ]}
                onChange={(v) => patch('showArrows', v === 'yes')}
              />
            </Field>
            <Field label="하단 닷 인디케이터">
              <SelectField
                value={c.showDots === true ? 'yes' : 'no'}
                options={[
                  { value: 'no', label: '숨김' },
                  { value: 'yes', label: '표시' },
                ]}
                onChange={(v) => patch('showDots', v === 'yes')}
              />
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}

function useMemoSorted(items: string[]): string[] {
  return Array.from(new Set(items)).sort();
}

// ─────────────────────────────────────────────────────
// Product Picker Dialog (자식 창)
// 진열 제품 선택 — 카테고리 필터 + 체크박스 + 순서 조정.
// ─────────────────────────────────────────────────────
function ProductPickerDialog({
  lensList,
  selectedIds,
  onClose,
  onSave,
}: {
  lensList: LensListItem[];
  selectedIds: string[];
  onClose: () => void;
  onSave: (ids: string[]) => void;
}) {
  const [working, setWorking] = useState<string[]>(selectedIds);
  const [filterBrand, setFilterBrand] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterCycle, setFilterCycle] = useState<string>('');
  const [query, setQuery] = useState('');

  const brands = useMemoSorted(lensList.map((l) => l.brand));
  const types = useMemoSorted(lensList.map((l) => l.lensType));
  const cycles = useMemoSorted(lensList.map((l) => l.replacementCycle));

  const filtered = lensList.filter((l) => {
    if (filterBrand && l.brand !== filterBrand) return false;
    if (filterType && l.lensType !== filterType) return false;
    if (filterCycle && l.replacementCycle !== filterCycle) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      if (
        !l.name.toLowerCase().includes(q) &&
        !l.brand.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  function toggle(id: string) {
    setWorking((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function reorder(idx: number, dir: -1 | 1) {
    setWorking((prev) => {
      const next = [...prev];
      const t = idx + dir;
      if (t < 0 || t >= next.length) return prev;
      [next[idx], next[t]] = [next[t], next[idx]];
      return next;
    });
  }

  const selectedItems = working
    .map((id) => lensList.find((l) => l.id === id))
    .filter((l): l is LensListItem => Boolean(l));

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full flex-col overflow-hidden bg-white sm:h-auto sm:max-h-[90vh] sm:max-w-4xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-3">
          <div>
            <h3 className="text-base font-bold">진열 제품 선택</h3>
            <p className="mt-0.5 text-[11px] text-gray-500">
              카테고리로 좁힌 뒤 체크하여 추가 · 우측에서 순서 조정
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="grid h-8 w-8 place-items-center rounded-full text-gray-400 hover:bg-gray-100"
          >
            ✕
          </button>
        </header>

        {/* 필터 바 */}
        <div className="shrink-0 border-b border-gray-100 bg-gray-50 px-5 py-3 space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <select
              value={filterBrand}
              onChange={(e) => setFilterBrand(e.target.value)}
              className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-xs"
            >
              <option value="">브랜드 전체</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-xs"
            >
              <option value="">유형 전체</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {LENS_TYPE_LABEL[t] ?? t}
                </option>
              ))}
            </select>
            <select
              value={filterCycle}
              onChange={(e) => setFilterCycle(e.target.value)}
              className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-xs"
            >
              <option value="">주기 전체</option>
              {cycles.map((cy) => (
                <option key={cy} value={cy}>
                  {CYCLE_LABEL[cy] ?? cy}
                </option>
              ))}
            </select>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="제품명 검색"
              className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-xs"
            />
          </div>
          {(filterBrand || filterType || filterCycle || query) && (
            <button
              type="button"
              onClick={() => {
                setFilterBrand('');
                setFilterType('');
                setFilterCycle('');
                setQuery('');
              }}
              className="text-[10px] text-gray-500 hover:text-gray-900 underline"
            >
              필터 초기화
            </button>
          )}
        </div>

        {/* 본문: 좌 후보 / 우 선택된 목록 */}
        <div className="flex flex-1 min-h-0 flex-col md:flex-row">
          <div className="flex flex-1 flex-col overflow-hidden border-b border-gray-100 md:border-b-0 md:border-r">
            <div className="flex items-center justify-between px-5 py-2 text-[11px] text-gray-500">
              <span>검색 결과 {filtered.length}종</span>
              {lensList.length === 0 && (
                <span className="text-amber-600">렌즈 데이터 로드 중…</span>
              )}
            </div>
            <ul className="flex-1 overflow-y-auto px-2 pb-3">
              {filtered.map((l) => {
                const checked = working.includes(l.id);
                return (
                  <li key={l.id}>
                    <label
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                        checked ? 'bg-brand-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(l.id)}
                        className="h-4 w-4"
                      />
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                        {l.brand}
                      </span>
                      <span className="flex-1 truncate">{l.name}</span>
                      <span className="text-[10px] text-gray-400">
                        {LENS_TYPE_LABEL[l.lensType] ?? l.lensType}
                        {' · '}
                        {CYCLE_LABEL[l.replacementCycle] ?? l.replacementCycle}
                      </span>
                    </label>
                  </li>
                );
              })}
              {filtered.length === 0 && lensList.length > 0 && (
                <li className="py-10 text-center text-xs text-gray-400">
                  조건에 맞는 제품이 없습니다
                </li>
              )}
            </ul>
          </div>

          {/* 우측 — 선택된 목록 + 순서 조정 */}
          <div className="flex w-full flex-col md:w-80">
            <div className="flex items-center justify-between px-5 py-2 text-[11px] text-gray-500">
              <span>
                선택됨{' '}
                <strong className="text-brand-600">{working.length}</strong>종
              </span>
              {working.length > 0 && (
                <button
                  type="button"
                  onClick={() => setWorking([])}
                  className="text-gray-400 hover:text-red-600"
                >
                  전체 해제
                </button>
              )}
            </div>
            <ol className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
              {selectedItems.length === 0 ? (
                <li className="rounded-lg border border-dashed border-gray-200 py-8 text-center text-[11px] text-gray-400">
                  좌측에서 제품을 체크하여 추가
                </li>
              ) : (
                selectedItems.map((l, idx) => (
                  <li
                    key={l.id}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-100 bg-gray-50 px-2 py-1.5 text-xs"
                  >
                    <span className="w-5 shrink-0 text-center font-mono text-[10px] text-gray-400">
                      {idx + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{l.name}</span>
                    <button
                      type="button"
                      onClick={() => reorder(idx, -1)}
                      disabled={idx === 0}
                      className="text-gray-400 hover:text-gray-900 disabled:opacity-30"
                      aria-label="위로"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => reorder(idx, 1)}
                      disabled={idx === selectedItems.length - 1}
                      className="text-gray-400 hover:text-gray-900 disabled:opacity-30"
                      aria-label="아래로"
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      onClick={() => toggle(l.id)}
                      className="text-red-500 hover:text-red-700"
                      aria-label="제거"
                    >
                      ✕
                    </button>
                  </li>
                ))
              )}
            </ol>
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
          <span className="text-[11px] text-gray-500">
            {working.length}종 선택 · 저장 시 모드가 자동으로 {'‘'}수동 선택{'’'} 으로 전환됩니다
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => onSave(working)}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-brand-700"
            >
              저장 ({working.length}종)
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// Category Chips
// ─────────────────────────────────────────────────────
function CategoryChipsEditor({ config, onChange }: SectionEditorProps) {
  const items =
    ((config as Record<string, unknown>).items as Array<{
      label: string;
      href: string;
      emoji?: string;
      badge?: string;
    }>) ?? [];

  function updateItem(idx: number, patch: Partial<(typeof items)[number]>) {
    const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    onChange({ ...config, items: next });
  }
  function addItem() {
    onChange({ ...config, items: [...items, { label: '', href: '' }] });
  }
  function removeItem(idx: number) {
    onChange({ ...config, items: items.filter((_, i) => i !== idx) });
  }

  return (
    <div className="space-y-2">
      {items.map((it, idx) => (
        <div key={idx} className="grid grid-cols-12 gap-2 rounded-lg border border-gray-200 p-2">
          <input
            className="col-span-1 h-9 rounded border border-gray-200 px-1 text-center"
            placeholder="🏷️"
            value={it.emoji ?? ''}
            onChange={(e) => updateItem(idx, { emoji: e.target.value })}
          />
          <input
            className="col-span-3 h-9 rounded border border-gray-200 px-2 text-sm"
            placeholder="라벨"
            value={it.label}
            onChange={(e) => updateItem(idx, { label: e.target.value })}
          />
          <input
            className="col-span-5 h-9 rounded border border-gray-200 px-2 text-sm font-mono text-xs"
            placeholder="/customer/order?type=..."
            value={it.href}
            onChange={(e) => updateItem(idx, { href: e.target.value })}
          />
          <input
            className="col-span-2 h-9 rounded border border-gray-200 px-2 text-sm"
            placeholder="HOT/NEW"
            value={it.badge ?? ''}
            onChange={(e) => updateItem(idx, { badge: e.target.value || undefined })}
          />
          <button
            type="button"
            onClick={() => removeItem(idx)}
            className="col-span-1 rounded bg-red-100 text-xs text-red-700 hover:bg-red-200"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        className="w-full rounded-lg border border-dashed border-gray-300 py-2 text-sm text-gray-500 hover:border-brand-400 hover:text-brand-600"
      >
        + 칩 추가
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// Banner Strip
// ─────────────────────────────────────────────────────
function BannerStripEditor({ config, onChange }: SectionEditorProps) {
  const c = config as Record<string, string | undefined>;
  function patch(k: string, v: string | undefined) {
    onChange({ ...config, [k]: v });
  }
  return (
    <div className="space-y-3">
      <Field label="메시지">
        <TextField value={c.message ?? ''} onChange={(v) => patch('message', v)} />
      </Field>
      <Field label="링크 (선택)">
        <TextField value={c.href ?? ''} onChange={(v) => patch('href', v)} placeholder="/customer/order" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="배경 색상">
          <ColorField value={c.bgColor ?? '#fef3c7'} onChange={(v) => patch('bgColor', v)} />
        </Field>
        <Field label="글자 색상">
          <ColorField value={c.textColor ?? '#92400e'} onChange={(v) => patch('textColor', v)} />
        </Field>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// Countdown
// ─────────────────────────────────────────────────────
function CountdownEditor({ config, onChange }: SectionEditorProps) {
  const c = config as Record<string, string | undefined>;
  function patch(k: string, v: string | undefined) {
    onChange({ ...config, [k]: v });
  }
  const endsAtLocal = c.endsAt ? c.endsAt.slice(0, 16) : '';
  return (
    <div className="space-y-3">
      <Field label="헤드라인">
        <TextField value={c.headline ?? ''} onChange={(v) => patch('headline', v)} />
      </Field>
      <Field label="서브라인">
        <TextField value={c.subline ?? ''} onChange={(v) => patch('subline', v)} />
      </Field>
      <Field label="종료 일시">
        <input
          type="datetime-local"
          value={endsAtLocal}
          onChange={(e) => patch('endsAt', e.target.value ? new Date(e.target.value).toISOString() : undefined)}
          className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="배경 색상">
          <ColorField value={c.bgColor ?? '#0f172a'} onChange={(v) => patch('bgColor', v)} />
        </Field>
        <Field label="글자 색상">
          <ColorField value={c.textColor ?? '#fbbf24'} onChange={(v) => patch('textColor', v)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="CTA 라벨">
          <TextField value={c.ctaLabel ?? ''} onChange={(v) => patch('ctaLabel', v)} />
        </Field>
        <Field label="CTA 링크">
          <TextField value={c.ctaHref ?? ''} onChange={(v) => patch('ctaHref', v)} />
        </Field>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// Brand Story
// ─────────────────────────────────────────────────────
function BrandStoryEditor({ config, onChange }: SectionEditorProps) {
  const c = config as Record<string, string | undefined>;
  function patch(k: string, v: string | undefined) {
    onChange({ ...config, [k]: v });
  }
  return (
    <div className="space-y-3">
      <Field label="브랜드명">
        <TextField value={c.brand ?? ''} onChange={(v) => patch('brand', v)} />
      </Field>
      <Field label="헤드라인">
        <TextField value={c.headline ?? ''} onChange={(v) => patch('headline', v)} />
      </Field>
      <Field label="본문">
        <TextArea value={c.body ?? ''} onChange={(v) => patch('body', v)} rows={3} />
      </Field>
      <Field label="이미지">
        <ImagePicker
          value={c.imageUrl ?? ''}
          onChange={(v) => patch('imageUrl', v)}
          folder="brand-story"
        />
      </Field>
      <Field label="레이아웃">
        <SelectField
          value={(c.layout as 'image-left' | 'image-right' | 'image-top') ?? 'image-right'}
          options={[
            { value: 'image-right', label: '이미지 오른쪽' },
            { value: 'image-left', label: '이미지 왼쪽' },
            { value: 'image-top', label: '이미지 위' },
          ]}
          onChange={(v) => patch('layout', v)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="CTA 라벨">
          <TextField value={c.ctaLabel ?? ''} onChange={(v) => patch('ctaLabel', v)} />
        </Field>
        <Field label="CTA 링크">
          <TextField value={c.ctaHref ?? ''} onChange={(v) => patch('ctaHref', v)} />
        </Field>
      </div>
    </div>
  );
}
