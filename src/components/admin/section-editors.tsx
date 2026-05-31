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
  const [filterBrand, setFilterBrand] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterCycle, setFilterCycle] = useState<string>('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetch('/api/lenses')
      .then((r) => r.json())
      .then((j) => {
        const items = (j.lenses ?? []) as Array<{
          lensId: string;
          brand: string;
          name: string;
          lensType: string;
          replacementCycle: string;
        }>;
        setLensList(
          items.map((l) => ({
            id: l.lensId,
            brand: l.brand,
            name: l.name,
            lensType: l.lensType,
            replacementCycle: l.replacementCycle,
          })),
        );
      });
  }, []);

  function patch(k: string, v: unknown) {
    onChange({ ...config, [k]: v });
  }

  const lensIds = (c.lensIds as string[]) ?? [];
  const brands = useMemoSorted(lensList.map((l) => l.brand));
  const types = useMemoSorted(lensList.map((l) => l.lensType));
  const cycles = useMemoSorted(lensList.map((l) => l.replacementCycle));

  const filtered = lensList.filter((l) => {
    if (filterBrand && l.brand !== filterBrand) return false;
    if (filterType && l.lensType !== filterType) return false;
    if (filterCycle && l.replacementCycle !== filterCycle) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      if (!l.name.toLowerCase().includes(q) && !l.brand.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  const selectedLenses = lensIds
    .map((id) => lensList.find((l) => l.id === id))
    .filter((l): l is LensListItem => Boolean(l));

  function reorder(idx: number, dir: -1 | 1) {
    const next = [...lensIds];
    const t = idx + dir;
    if (t < 0 || t >= next.length) return;
    [next[idx], next[t]] = [next[t], next[idx]];
    patch('lensIds', next);
  }

  const layout = (c.layout as 'grid' | 'carousel') ?? 'grid';

  return (
    <div className="space-y-4">
      <Field label="큐레이션 모드">
        <SelectField
          value={(c.mode as string) ?? 'best'}
          options={[
            { value: 'best', label: '베스트 (총 주문량 기준)' },
            { value: 'trending', label: '트렌딩 (최근 7일 주문량)' },
            { value: 'new', label: '신상품 (등록일 최신순)' },
            { value: 'manual', label: '수동 선택' },
          ]}
          onChange={(v) => patch('mode', v)}
        />
      </Field>

      {c.mode === 'manual' && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2.5">
          <div className="flex items-baseline justify-between">
            <div className="text-xs font-semibold text-gray-700">
              노출할 상품{' '}
              <span className="text-brand-600">({lensIds.length}종 선택)</span>
            </div>
            {lensIds.length > 0 && (
              <button
                type="button"
                onClick={() => patch('lensIds', [])}
                className="text-[10px] text-gray-400 hover:text-gray-700"
              >
                전체 해제
              </button>
            )}
          </div>

          {/* 카테고리 필터 */}
          <div className="grid grid-cols-3 gap-2">
            <select
              value={filterBrand}
              onChange={(e) => setFilterBrand(e.target.value)}
              className="h-8 rounded-lg border border-gray-300 px-2 text-xs"
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
              className="h-8 rounded-lg border border-gray-300 px-2 text-xs"
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
              className="h-8 rounded-lg border border-gray-300 px-2 text-xs"
            >
              <option value="">주기 전체</option>
              {cycles.map((cy) => (
                <option key={cy} value={cy}>
                  {CYCLE_LABEL[cy] ?? cy}
                </option>
              ))}
            </select>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제품명 검색"
            className="h-8 w-full rounded-lg border border-gray-300 px-2 text-xs"
          />

          {/* 필터 결과 — 체크박스 리스트 */}
          <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
            <div className="mb-1 text-[10px] text-gray-400">
              검색 결과 {filtered.length}종
            </div>
            {filtered.map((l) => (
              <label key={l.id} className="flex items-center gap-2 py-1 text-xs hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={lensIds.includes(l.id)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...lensIds, l.id]
                      : lensIds.filter((x) => x !== l.id);
                    patch('lensIds', next);
                  }}
                />
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                  {l.brand}
                </span>
                <span className="truncate">{l.name}</span>
                <span className="ml-auto text-[10px] text-gray-400">
                  {LENS_TYPE_LABEL[l.lensType] ?? l.lensType}
                  {' · '}
                  {CYCLE_LABEL[l.replacementCycle] ?? l.replacementCycle}
                </span>
              </label>
            ))}
            {filtered.length === 0 && (
              <div className="py-6 text-center text-[11px] text-gray-400">
                필터 조건에 맞는 제품이 없습니다
              </div>
            )}
          </div>

          {/* 선택된 순서 */}
          {selectedLenses.length > 0 && (
            <div className="rounded-lg border border-brand-200 bg-white p-2">
              <div className="mb-1 text-[10px] font-medium text-brand-700">
                노출 순서 (위에서부터 표시)
              </div>
              <ol className="space-y-1">
                {selectedLenses.map((l, idx) => (
                  <li
                    key={l.id}
                    className="flex items-center gap-2 rounded border border-gray-100 bg-gray-50 px-2 py-1 text-xs"
                  >
                    <span className="text-[10px] font-mono text-gray-400">
                      {idx + 1}
                    </span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                      {l.brand}
                    </span>
                    <span className="flex-1 truncate">{l.name}</span>
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
                      disabled={idx === selectedLenses.length - 1}
                      className="text-gray-400 hover:text-gray-900 disabled:opacity-30"
                      aria-label="아래로"
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        patch('lensIds', lensIds.filter((x) => x !== l.id))
                      }
                      className="text-red-500 hover:text-red-700"
                      aria-label="삭제"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
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
