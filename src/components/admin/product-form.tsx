'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ImagePicker } from '@/components/admin/image-picker';
import { ProductEditor } from '@/components/admin/product-editor';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  type ContentBlock,
  parseBlocks,
  serializeBlocks,
} from '@/lib/content/blocks';

const LENS_TYPES = [
  { value: 'spherical', label: '일반 (Spherical)' },
  { value: 'toric', label: '난시 (Toric)' },
  { value: 'multifocal', label: '다초점 (Multifocal)' },
  { value: 'color', label: '컬러 (Color)' },
  { value: 'circle', label: '써클 (Circle)' },
] as const;

const CYCLES = [
  { value: '1day', label: '원데이' },
  { value: '2week', label: '2주' },
  { value: '1month', label: '1개월' },
  { value: '3month', label: '3개월' },
  { value: '6month', label: '6개월' },
  { value: '1year', label: '1년' },
] as const;

interface FormState {
  productCode: string;
  brand: string;
  name: string;
  lensType: string;
  replacementCycle: string;
  piecesPerBox: number;
  price: number;
  cost: number | '';
  imageUrl: string;
  baseCurve: string;
  diameter: string;
  waterContent: string;
  material: string;
  sphereMin: string;
  sphereMax: string;
  // 식약처 UDI 참조 (수기 입력 또는 UDI 적재 시 자동 채움)
  mfdsPermitNo: string;
  mfdsClassificationCode: string;
  mfdsProductName: string;
  manufacturer: string;
  colorName: string;
  colorHex: string;
  colorPreviewUrl: string;
  seriesCode: string;
  isNew: boolean;
  isActive: boolean;
}

const EMPTY: FormState = {
  productCode: '',
  brand: '',
  name: '',
  lensType: 'spherical',
  replacementCycle: '1day',
  piecesPerBox: 30,
  price: 0,
  cost: '',
  imageUrl: '',
  baseCurve: '',
  diameter: '',
  waterContent: '',
  material: '',
  sphereMin: '',
  sphereMax: '',
  mfdsPermitNo: '',
  mfdsClassificationCode: '',
  mfdsProductName: '',
  manufacturer: '',
  colorName: '',
  colorHex: '',
  colorPreviewUrl: '',
  seriesCode: '',
  isNew: false,
  isActive: true,
};

export function ProductForm({
  mode,
  initial,
}: {
  mode: 'create' | 'edit';
  initial?: Partial<FormState> & { id?: string; description?: string | null };
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({ ...EMPTY, ...initial });
  const [blocks, setBlocks] = useState<ContentBlock[]>(
    parseBlocks(initial?.description ?? null),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = {
        ...form,
        cost: form.cost === '' ? null : Number(form.cost),
        description: serializeBlocks(blocks),
      };

      const res = await fetch(
        mode === 'create'
          ? '/api/admin/lenses'
          : `/api/admin/lenses/${initial?.id}`,
        {
          method: mode === 'create' ? 'POST' : 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
      );

      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? '저장 실패');
        return;
      }
      router.push('/admin/products');
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!initial?.id) return;
    if (!confirm('정말 이 제품을 삭제하시겠습니까? 도수별 SKU 도 함께 비활성화됩니다.')) return;
    setSaving(true);
    const res = await fetch(`/api/admin/lenses/${initial.id}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/admin/products');
      router.refresh();
    } else {
      setError('삭제 실패');
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* 기본 정보 */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>기본 정보</CardTitle>
            <CardDescription>제품을 식별하는 필수 정보입니다.</CardDescription>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="브랜드 *">
              <input
                value={form.brand}
                onChange={(e) => update('brand', e.target.value)}
                placeholder="예: ACUVUE"
                className="input"
              />
            </Field>
            <Field label="제품 코드 *">
              <input
                value={form.productCode}
                onChange={(e) => update('productCode', e.target.value)}
                placeholder="예: ACU-OAS1D"
                className="input font-mono"
              />
            </Field>
            <Field label="제품명 *" full>
              <input
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="예: OASYS 1-Day"
                className="input"
              />
            </Field>
            <Field label="렌즈 유형 *">
              <select
                value={form.lensType}
                onChange={(e) => update('lensType', e.target.value)}
                className="input"
              >
                {LENS_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="교체 주기 *">
              <select
                value={form.replacementCycle}
                onChange={(e) => update('replacementCycle', e.target.value)}
                className="input"
              >
                {CYCLES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="박스당 매수">
              <input
                type="number"
                min={1}
                value={form.piecesPerBox}
                onChange={(e) => update('piecesPerBox', Number(e.target.value))}
                className="input"
              />
            </Field>
            <Field label="대표 이미지">
              <ImagePicker
                value={form.imageUrl}
                onChange={(v) => update('imageUrl', v)}
                folder="lenses"
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      {/* 가격 */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>가격</CardTitle>
            <CardDescription>원가는 매출 분석 / 영업이익 계산에만 사용됩니다.</CardDescription>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="판매가 (₩) *">
              <input
                type="number"
                min={0}
                value={form.price}
                onChange={(e) => update('price', Number(e.target.value))}
                className="input"
              />
            </Field>
            <Field label="원가 (₩)">
              <input
                type="number"
                min={0}
                value={form.cost}
                onChange={(e) => update('cost', e.target.value === '' ? '' : Number(e.target.value))}
                className="input"
                placeholder="(선택)"
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      {/* 렌즈 스펙 */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>렌즈 스펙</CardTitle>
            <CardDescription>제조사 공식 사양. 추후 식약처 UDI 와 자동 매칭됩니다.</CardDescription>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="BC (베이스커브)">
              <input
                value={form.baseCurve}
                onChange={(e) => update('baseCurve', e.target.value)}
                placeholder="8.50"
                className="input"
              />
            </Field>
            <Field label="DIA (직경)">
              <input
                value={form.diameter}
                onChange={(e) => update('diameter', e.target.value)}
                placeholder="14.20"
                className="input"
              />
            </Field>
            <Field label="함수율 (%)">
              <input
                value={form.waterContent}
                onChange={(e) => update('waterContent', e.target.value)}
                placeholder="38"
                className="input"
              />
            </Field>
            <Field label="재질">
              <input
                value={form.material}
                onChange={(e) => update('material', e.target.value)}
                placeholder="senofilcon A"
                className="input"
              />
            </Field>
            <Field label="도수 최소 (구면)">
              <input
                value={form.sphereMin}
                onChange={(e) => update('sphereMin', e.target.value)}
                placeholder="-12.00"
                className="input"
              />
            </Field>
            <Field label="도수 최대 (구면)">
              <input
                value={form.sphereMax}
                onChange={(e) => update('sphereMax', e.target.value)}
                placeholder="+6.00"
                className="input"
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      {/* 쇼핑몰 카드 표시 */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>쇼핑몰 카드 표시</CardTitle>
            <CardDescription>
              홈 화면 / 카테고리 페이지의 상품 카드 디자인 (카페24 스타일).
            </CardDescription>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="컬러명 (카드 표시)">
              <input
                value={form.colorName}
                onChange={(e) => update('colorName', e.target.value)}
                placeholder="예: 브라운, 글로우 블랙, 초코"
                className="input"
              />
            </Field>
            <Field label="시리즈 코드 (선택)">
              <input
                value={form.seriesCode}
                onChange={(e) => update('seriesCode', e.target.value)}
                placeholder="예: CHRISTIN-1DAY (같은 시리즈 컬러 묶음)"
                className="input font-mono"
              />
            </Field>
            <Field label="컬러 미리보기 이미지 (선택, 우선)">
              <ImagePicker
                value={form.colorPreviewUrl}
                onChange={(v) => update('colorPreviewUrl', v)}
                folder="lenses/color"
              />
            </Field>
            <Field label="컬러 HEX (이미지 없을 때 폴백)">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.colorHex || '#8B5A2B'}
                  onChange={(e) => update('colorHex', e.target.value)}
                  className="h-10 w-12 cursor-pointer rounded border border-gray-300"
                />
                <input
                  value={form.colorHex}
                  onChange={(e) => update('colorHex', e.target.value)}
                  placeholder="#8B5A2B"
                  className="input flex-1 font-mono"
                />
                {form.colorHex && (
                  <button
                    type="button"
                    onClick={() => update('colorHex', '')}
                    className="text-xs text-gray-400 hover:text-gray-900"
                  >
                    ✕
                  </button>
                )}
              </div>
            </Field>
            <Field label="NEW 뱃지">
              <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.isNew}
                  onChange={(e) => update('isNew', e.target.checked)}
                  className="h-4 w-4"
                />
                카드 우상단에 NEW 뱃지 표시
              </label>
            </Field>
          </div>
        </CardBody>
      </Card>

      {/* 식약처 UDI 참조 */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>식약처 UDI 참조</CardTitle>
            <CardDescription>
              비워두면 됩니다 — 추후 식약처 UDI 일괄 갱신 시 자동으로 채워집니다.
              수기 입력하면 즉시 영수증·세금계산서 표시에 사용됩니다.
            </CardDescription>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="식약처 등록 품목명">
              <input
                value={form.mfdsProductName}
                onChange={(e) => update('mfdsProductName', e.target.value)}
                placeholder="예: 존슨앤드존슨비전케어 원데이아큐브오아시스"
                className="input"
              />
            </Field>
            <Field label="제조원 / 수입원">
              <input
                value={form.manufacturer}
                onChange={(e) => update('manufacturer', e.target.value)}
                placeholder="예: Johnson & Johnson Vision"
                className="input"
              />
            </Field>
            <Field label="품목 허가번호">
              <input
                value={form.mfdsPermitNo}
                onChange={(e) => update('mfdsPermitNo', e.target.value)}
                placeholder="예: 제조허가 21-1234 또는 수입허가 ..."
                className="input font-mono"
              />
            </Field>
            <Field label="분류번호">
              <input
                value={form.mfdsClassificationCode}
                onChange={(e) => update('mfdsClassificationCode', e.target.value)}
                placeholder="A07020 (콘택트렌즈)"
                className="input font-mono"
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      {/* 콘텐츠 편집기 */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>상세 콘텐츠</CardTitle>
            <CardDescription>이미지 · 영상 · 설명을 블록 단위로 구성하세요.</CardDescription>
          </div>
        </CardHeader>
        <CardBody>
          <ProductEditor blocks={blocks} onChange={setBlocks} />
        </CardBody>
      </Card>

      {/* 푸터 액션 */}
      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-2 border-t border-gray-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:-mx-8 md:px-8">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => update('isActive', e.target.checked)}
              className="h-4 w-4"
            />
            노출 활성화
          </label>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
        <div className="flex items-center gap-2">
          {mode === 'edit' && (
            <Button variant="danger" onClick={remove} disabled={saving}>
              삭제
            </Button>
          )}
          <Button variant="secondary" onClick={() => history.back()} disabled={saving}>
            취소
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? '저장 중...' : mode === 'create' ? '등록' : '저장'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? 'md:col-span-2' : undefined}>
      <label className="mb-1.5 block text-xs font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}
