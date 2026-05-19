'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { BrandManagerModal } from '@/components/admin/brand-manager-modal';
import { ProductCodeManagerModal } from '@/components/admin/product-code-manager-modal';
import { PowerChartModal, type PowerCell } from '@/components/admin/power-chart-modal';
import { ImagePicker } from '@/components/admin/image-picker';
import { ProductEditor } from '@/components/admin/product-editor';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  type ContentBlock,
  parseBlocks,
  serializeBlocks,
} from '@/lib/content/blocks';
import {
  effectivePurchaseCost,
  effectiveSupplyPrice,
  retailMarginRate,
  supplyMarginRate,
  toVatExcluded,
  validatePricing,
} from '@/lib/pricing';

interface BrandOption {
  id: string;
  nameKo: string;
  nameEn: string;
  code: string;
}

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
  // 기존 가격 (호환). 신규 등록은 standardCost/standardSupplyPrice/recommendedRetailPrice 사용.
  price: number;
  cost: number | '';
  // 신규 가격 모델 — 모두 부가세 포함 (KRW). 빈 문자열 = 미입력 (NULL).
  standardCost: number | '';
  purchaseDiscountAmount: number;
  purchaseDiscountPercent: number;
  standardSupplyPrice: number | '';
  supplyDiscountAmount: number;
  supplyDiscountPercent: number;
  recommendedRetailPrice: number | '';
  // 가격 적용 기간 (각 영역별) — startsAt 미입력 시 즉시 적용, endsAt 미입력 시 무기한
  purchaseStartsAt: string;
  purchaseEndsAt: string;
  supplyStartsAt: string;
  supplyEndsAt: string;
  retailStartsAt: string;
  retailEndsAt: string;
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
  standardCost: '',
  purchaseDiscountAmount: 0,
  purchaseDiscountPercent: 0,
  standardSupplyPrice: '',
  supplyDiscountAmount: 0,
  supplyDiscountPercent: 0,
  recommendedRetailPrice: '',
  purchaseStartsAt: '',
  purchaseEndsAt: '',
  supplyStartsAt: '',
  supplyEndsAt: '',
  retailStartsAt: '',
  retailEndsAt: '',
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

  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [productCodeModalOpen, setProductCodeModalOpen] = useState(false);
  /** 제품 코드 모달에서 선택한 시리즈 — 제품명 자동 생성에 사용. */
  const [seriesNameKo, setSeriesNameKo] = useState('');
  /** true: 제품명 자동 생성. 사용자가 input 을 직접 수정하면 false 로 전환. */
  const [autoNameMode, setAutoNameMode] = useState(mode === 'create');
  /** 상단 대분류 탭. */
  const [tab, setTab] = useState<'productInfo' | 'saleInfo' | 'priceInfo' | 'mfdsInfo'>(
    'productInfo',
  );

  /** 파워챠트 모달 + 도수 리스트 (Phase 1, lens_variants 저장 연동은 Phase 2). */
  const [powerChartOpen, setPowerChartOpen] = useState(false);
  const [powerList, setPowerList] = useState<PowerCell[]>([]);
  const isToric = form.lensType === 'toric';

  // 자동 생성 — 브랜드/시리즈/팩 수량 변경 시 제품명 갱신
  useEffect(() => {
    if (!autoNameMode) return;
    if (!form.brand || !seriesNameKo) return;
    const parts = [form.brand, seriesNameKo];
    if (form.piecesPerBox > 0) parts.push(`${form.piecesPerBox}팩`);
    const next = parts.join(' ');
    setForm((p) => (p.name === next ? p : { ...p, name: next }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoNameMode, form.brand, seriesNameKo, form.piecesPerBox]);

  async function refreshBrands() {
    try {
      const res = await fetch('/api/admin/brands', { cache: 'no-store' });
      if (res.ok) {
        const body = await res.json();
        setBrands(body.brands ?? []);
      }
    } catch {
      /* swallow */
    }
  }

  useEffect(() => {
    refreshBrands();
  }, []);

  async function save() {
    // 가격 검증 — error 가 있으면 저장 차단
    const pricingIssues = validatePricing({
      standardCost: form.standardCost === '' ? null : form.standardCost,
      purchaseDiscountAmount: form.purchaseDiscountAmount,
      purchaseDiscountPercent: form.purchaseDiscountPercent,
      standardSupplyPrice: form.standardSupplyPrice === '' ? null : form.standardSupplyPrice,
      supplyDiscountAmount: form.supplyDiscountAmount,
      supplyDiscountPercent: form.supplyDiscountPercent,
      recommendedRetailPrice:
        form.recommendedRetailPrice === '' ? null : form.recommendedRetailPrice,
    });
    const errors = pricingIssues.filter((i) => i.severity === 'error');
    if (errors.length > 0) {
      setError(errors[0].message);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const body = {
        ...form,
        cost: form.cost === '' ? null : Number(form.cost),
        standardCost: form.standardCost === '' ? null : Number(form.standardCost),
        standardSupplyPrice:
          form.standardSupplyPrice === '' ? null : Number(form.standardSupplyPrice),
        recommendedRetailPrice:
          form.recommendedRetailPrice === '' ? null : Number(form.recommendedRetailPrice),
        purchaseStartsAt: form.purchaseStartsAt || null,
        purchaseEndsAt: form.purchaseEndsAt || null,
        supplyStartsAt: form.supplyStartsAt || null,
        supplyEndsAt: form.supplyEndsAt || null,
        retailStartsAt: form.retailStartsAt || null,
        retailEndsAt: form.retailEndsAt || null,
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
      {/* 대분류 탭 */}
      <div className="sticky top-0 z-10 -mx-4 flex gap-1 overflow-x-auto border-b border-gray-200 bg-white px-4 py-2 md:-mx-8 md:px-8">
        {([
          { key: 'productInfo', label: '제품 정보' },
          { key: 'saleInfo', label: '판매 정보' },
          { key: 'priceInfo', label: '가격 정보' },
          { key: 'mfdsInfo', label: '식약처 UDI' },
        ] as const).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === t.key
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* === 제품 정보 탭 === */}
      <div className={tab === 'productInfo' ? 'space-y-5' : 'hidden'}>
      {/* 기본 정보 */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>기본 정보</CardTitle>
            <CardDescription>제품을 식별하는 필수 정보입니다.</CardDescription>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          {/* 1행: 5컬럼 (브랜드 / 제품 코드 / 렌즈 유형 / 교체 주기 / 팩당 수량) */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Field
              label="브랜드"
              required
              actionText="+ 등록"
              onAction={() => setBrandModalOpen(true)}
            >
              <select
                value={form.brand}
                onChange={(e) => update('brand', e.target.value)}
                className="input"
              >
                <option value="">— 선택 —</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.nameKo}>
                    {b.nameKo} ({b.code})
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="제품 코드"
              required
              actionText="+ 등록"
              onAction={() => setProductCodeModalOpen(true)}
            >
              <input
                value={form.productCode}
                onChange={(e) => update('productCode', e.target.value)}
                placeholder="ACU-OAS1D"
                className="input font-mono"
              />
            </Field>
            <Field label="렌즈 유형" required>
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
            <Field label="교체 주기" required>
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
            <Field label="팩당 수량">
              <input
                type="number"
                min={1}
                value={form.piecesPerBox}
                onChange={(e) => update('piecesPerBox', Number(e.target.value))}
                placeholder="예: 30"
                className="input"
              />
            </Field>
          </div>

          {/* 2행: 제품명 (full width) */}
          <div>
            <Field label="제품명" required>
              <div className="flex gap-1.5">
                <input
                  value={form.name}
                  onChange={(e) => {
                    setAutoNameMode(false);
                    update('name', e.target.value);
                  }}
                  placeholder="브랜드 + 시리즈 + 수량 선택 시 자동 생성 — 직접 편집 가능"
                  className="input flex-1"
                />
                {!autoNameMode && (
                  <button
                    type="button"
                    onClick={() => setAutoNameMode(true)}
                    className="shrink-0 rounded-lg border border-gray-300 px-3 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    title="브랜드 + 시리즈 + 팩 수량으로 자동 채우기"
                  >
                    🔄 자동
                  </button>
                )}
              </div>
              <p className="mt-1 text-[11px] text-gray-400">
                {autoNameMode
                  ? '🔄 자동 생성 모드 — 브랜드/시리즈/팩 수량 변경 시 갱신'
                  : '✏️ 직접 입력 모드 — 자동으로 되돌리려면 우측 🔄 자동 버튼'}
              </p>
            </Field>
          </div>

          {/* 3행: 대표 이미지 */}
          <div>
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
            <Field
              label="도수 최소 (구면)"
              actionText="+ 파워챠트"
              onAction={() => setPowerChartOpen(true)}
            >
              <input
                value={form.sphereMin}
                onChange={(e) => update('sphereMin', e.target.value)}
                placeholder="-12.00"
                className="input"
              />
            </Field>
            <Field
              label="도수 최대 (구면)"
              actionText="+ 파워챠트"
              onAction={() => setPowerChartOpen(true)}
            >
              <input
                value={form.sphereMax}
                onChange={(e) => update('sphereMax', e.target.value)}
                placeholder="+6.00"
                className="input"
              />
            </Field>
          </div>

          {/* 도수 입력 — 파워챠트 + 도수 리스트 */}
          <div className="mt-5 rounded-xl border-2 border-brand-200 bg-brand-50/40 p-4">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-brand-700">📊 도수 입력 (파워챠트)</h3>
                <p className="mt-0.5 text-[11px] text-gray-600">
                  파워챠트(자식창)로 sphere {isToric && '× cylinder '}범위 선택 → 적용 시 아래
                  리스트에 추가
                  {isToric && ' (난시 렌즈)'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPowerChartOpen(true)}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-brand-700"
              >
                + 파워챠트 열기
              </button>
            </div>

            {powerList.length === 0 ? (
              <div className="rounded-lg border border-dashed border-brand-300 bg-white py-4 text-center text-[12px] text-gray-500">
                아직 선택된 도수가 없습니다 — <strong className="text-brand-700">+ 파워챠트 열기</strong> 버튼으로 시작
              </div>
            ) : (
              <div className="space-y-1">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  선택된 도수 ({powerList.length})
                </div>
                <div className="flex max-h-48 flex-wrap gap-1 overflow-y-auto rounded-lg bg-white p-2">
                  {powerList.map((p, i) => (
                    <span
                      key={`${p.sphere}-${p.cylinder}-${i}`}
                      className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 font-mono text-[10px] text-gray-700"
                    >
                      SPH {p.sphere > 0 ? '+' : p.sphere < 0 ? '−' : ''}
                      {Math.abs(p.sphere).toFixed(2)}
                      {isToric && (
                        <>
                          {' '}/ CYL {p.cylinder > 0 ? '+' : p.cylinder < 0 ? '−' : ''}
                          {Math.abs(p.cylinder).toFixed(2)}
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setPowerList((prev) => prev.filter((_, idx) => idx !== i))
                        }
                        className="ml-0.5 text-gray-400 hover:text-red-600"
                        title="제거"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="mt-1.5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setPowerList([])}
                    className="text-[11px] text-gray-500 hover:text-red-600"
                  >
                    전체 삭제
                  </button>
                </div>
              </div>
            )}
            <p className="mt-2 text-[11px] text-amber-700">
              ⓘ 도수 리스트는 Phase 2 에서 lens_variants 로 저장됩니다 (현재는 폼 state 만).
            </p>
          </div>
        </CardBody>
      </Card>

      </div>

      {/* === 판매 정보 탭 === */}
      <div className={tab === 'saleInfo' ? 'space-y-5' : 'hidden'}>
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

      {/* 콘텐츠 편집기 (saleInfo 탭 내부, UDI 앞으로 이동) */}
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
      </div>

      {/* === 가격 정보 탭 === */}
      <div className={tab === 'priceInfo' ? 'space-y-5' : 'hidden'}>
      <PricingCard form={form} update={update} />
      </div>

      {/* === 식약처 UDI 탭 === */}
      <div className={tab === 'mfdsInfo' ? 'space-y-5' : 'hidden'}>
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

      </div>

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

      <BrandManagerModal
        open={brandModalOpen}
        onClose={() => setBrandModalOpen(false)}
        onCreated={(b) => {
          refreshBrands();
          update('brand', b.nameKo);
        }}
      />

      <ProductCodeManagerModal
        open={productCodeModalOpen}
        onClose={() => setProductCodeModalOpen(false)}
        onSelect={(pc) => {
          // 현재 선택된 브랜드의 약자(code) + 제품 코드(code+suffix) 자동 조합
          const brand = brands.find((b) => b.nameKo === form.brand);
          const brandCode = brand?.code ?? '???';
          update('productCode', `${brandCode}-${pc.code}${pc.suffix}`);
          // 시리즈명도 저장 — 제품명 자동 생성에 사용
          setSeriesNameKo(pc.nameKo);
        }}
      />

      <PowerChartModal
        open={powerChartOpen}
        onClose={() => setPowerChartOpen(false)}
        enableCylinder={isToric}
        onApply={(cells) => {
          // 기존 + 새 셀, 중복 제거
          const seen = new Set(powerList.map((p) => `${p.sphere}|${p.cylinder}`));
          const dedup = [...powerList];
          for (const c of cells) {
            const key = `${c.sphere}|${c.cylinder}`;
            if (!seen.has(key)) {
              seen.add(key);
              dedup.push(c);
            }
          }
          // sphere 내림차순, cyl 오름차순 정렬
          dedup.sort((a, b) => b.sphere - a.sphere || a.cylinder - b.cylinder);
          setPowerList(dedup);
        }}
      />
    </div>
  );
}

function Field({
  label,
  children,
  full,
  required,
  actionText,
  onAction,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
  required?: boolean;
  actionText?: string;
  onAction?: () => void;
}) {
  return (
    <div className={full ? 'md:col-span-2' : undefined}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label className="text-xs font-medium text-gray-700">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
        {actionText && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="text-[11px] font-medium text-brand-600 hover:underline"
          >
            {actionText}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

interface PricingCardProps {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}

function PricingCard({ form, update }: PricingCardProps) {
  // 매입/공급 영역 부가세 표시 모드 (UI 만, DB 는 항상 부가세 포함)
  const [vatMode, setVatMode] = useState<'included' | 'excluded'>('included');
  const vatTax = vatMode === 'excluded';

  const purchaseCost = useMemo(
    () =>
      effectivePurchaseCost(
        form.standardCost === '' ? null : form.standardCost,
        form.purchaseDiscountAmount,
        form.purchaseDiscountPercent,
      ),
    [form.standardCost, form.purchaseDiscountAmount, form.purchaseDiscountPercent],
  );
  const supplyPrice = useMemo(
    () =>
      effectiveSupplyPrice(
        form.standardSupplyPrice === '' ? null : form.standardSupplyPrice,
        form.supplyDiscountAmount,
        form.supplyDiscountPercent,
      ),
    [form.standardSupplyPrice, form.supplyDiscountAmount, form.supplyDiscountPercent],
  );
  const retail = form.recommendedRetailPrice === '' ? 0 : form.recommendedRetailPrice;

  const supplyMargin = supplyMarginRate(supplyPrice, purchaseCost);
  const retailMargin = retailMarginRate(retail, supplyPrice);

  const issues = useMemo(
    () =>
      validatePricing({
        standardCost: form.standardCost === '' ? null : form.standardCost,
        purchaseDiscountAmount: form.purchaseDiscountAmount,
        purchaseDiscountPercent: form.purchaseDiscountPercent,
        standardSupplyPrice: form.standardSupplyPrice === '' ? null : form.standardSupplyPrice,
        supplyDiscountAmount: form.supplyDiscountAmount,
        supplyDiscountPercent: form.supplyDiscountPercent,
        recommendedRetailPrice: form.recommendedRetailPrice === '' ? null : form.recommendedRetailPrice,
      }),
    [
      form.standardCost,
      form.purchaseDiscountAmount,
      form.purchaseDiscountPercent,
      form.standardSupplyPrice,
      form.supplyDiscountAmount,
      form.supplyDiscountPercent,
      form.recommendedRetailPrice,
    ],
  );

  /** DB 저장값 (부가세 포함) ↔ 화면 표시값 (vatMode 따라 환산). */
  const display = (vatIncludedAmount: number): number =>
    vatTax ? toVatExcluded(vatIncludedAmount) : vatIncludedAmount;

  /** 사용자 입력값 → DB 저장값 (부가세 포함). */
  const fromInput = (rawNumber: number): number =>
    vatTax ? Math.round(rawNumber * 1.1) : rawNumber;

  function setMaybe<K extends keyof FormState>(k: K, raw: string) {
    if (raw === '') {
      update(k, '' as FormState[K]);
      return;
    }
    const n = Number(raw);
    if (Number.isNaN(n)) return;
    update(k, fromInput(n) as FormState[K]);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex w-full items-start justify-between gap-3">
          <div>
            <CardTitle>가격 (모든 금액 부가세 포함 기준 저장)</CardTitle>
            <CardDescription>
              매입/공급 영역만 부가세 토글로 환산 표시. 소비자 가격은 항상 부가세 포함.
            </CardDescription>
          </div>
          <div className="flex shrink-0 rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setVatMode('included')}
              className={`rounded px-2.5 py-1 ${
                vatMode === 'included' ? 'bg-white font-semibold text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              부가세 포함
            </button>
            <button
              type="button"
              onClick={() => setVatMode('excluded')}
              className={`rounded px-2.5 py-1 ${
                vatMode === 'excluded' ? 'bg-white font-semibold text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              부가세 별도
            </button>
          </div>
        </div>
      </CardHeader>
      <CardBody className="space-y-5">
        {/* 매입 */}
        <div className="rounded-xl border border-gray-200 p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">매입 (제조사 → 본사)</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label={`표준매입가 (₩, ${vatTax ? '부가세 별도' : '부가세 포함'})`}>
              <input
                type="number"
                min={0}
                value={form.standardCost === '' ? '' : display(form.standardCost)}
                onChange={(e) => setMaybe('standardCost', e.target.value)}
                placeholder="(선택)"
                className="input"
              />
            </Field>
            <Field label="매입할인 (₩)">
              <input
                type="number"
                min={0}
                value={display(form.purchaseDiscountAmount)}
                onChange={(e) =>
                  update(
                    'purchaseDiscountAmount',
                    e.target.value === '' ? 0 : fromInput(Number(e.target.value)),
                  )
                }
                className="input"
              />
            </Field>
            <Field label="매입할인 (%)">
              <input
                type="number"
                min={0}
                max={100}
                value={form.purchaseDiscountPercent}
                onChange={(e) => update('purchaseDiscountPercent', Number(e.target.value || 0))}
                className="input"
              />
            </Field>
          </div>
          <ReadOnlyRow
            label="매입가 (실효)"
            value={display(purchaseCost)}
            hint={vatTax ? '부가세 별도' : '부가세 포함'}
          />
          <DateRangeRow
            startLabel="매입가 적용 시작"
            endLabel="종료 (선택)"
            start={form.purchaseStartsAt}
            end={form.purchaseEndsAt}
            onStart={(v) => update('purchaseStartsAt', v)}
            onEnd={(v) => update('purchaseEndsAt', v)}
          />
        </div>

        {/* 공급 */}
        <div className="rounded-xl border border-gray-200 p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">공급 (본사 → 가맹점)</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label={`표준공급가 (₩, ${vatTax ? '부가세 별도' : '부가세 포함'})`}>
              <input
                type="number"
                min={0}
                value={form.standardSupplyPrice === '' ? '' : display(form.standardSupplyPrice)}
                onChange={(e) => setMaybe('standardSupplyPrice', e.target.value)}
                placeholder="(선택)"
                className="input"
              />
            </Field>
            <Field label="공급할인 (₩)">
              <input
                type="number"
                min={0}
                value={display(form.supplyDiscountAmount)}
                onChange={(e) =>
                  update(
                    'supplyDiscountAmount',
                    e.target.value === '' ? 0 : fromInput(Number(e.target.value)),
                  )
                }
                className="input"
              />
            </Field>
            <Field label="공급할인 (%)">
              <input
                type="number"
                min={0}
                max={100}
                value={form.supplyDiscountPercent}
                onChange={(e) => update('supplyDiscountPercent', Number(e.target.value || 0))}
                className="input"
              />
            </Field>
          </div>
          <ReadOnlyRow
            label="할인공급가 (실효)"
            value={display(supplyPrice)}
            hint={vatTax ? '부가세 별도' : '부가세 포함'}
          />
          {supplyPrice > 0 && purchaseCost > 0 && (
            <div className="mt-2 text-[11px] text-gray-500">
              본사 마진율 (공급가 vs 매입가, 부가세 포함 기준):{' '}
              <span className={supplyMargin < 0 ? 'font-semibold text-red-600' : 'font-medium text-gray-700'}>
                {supplyMargin.toFixed(2)}%
              </span>
            </div>
          )}
          <DateRangeRow
            startLabel="공급가 적용 시작"
            endLabel="종료 (선택)"
            start={form.supplyStartsAt}
            end={form.supplyEndsAt}
            onStart={(v) => update('supplyStartsAt', v)}
            onEnd={(v) => update('supplyEndsAt', v)}
          />
        </div>

        {/* 소비자 (항상 부가세 포함) */}
        <div className="rounded-xl border border-gray-200 p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">
            소비자 가격{' '}
            <span className="text-[11px] font-normal text-gray-400">(부가세 포함, 소매 표준)</span>
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="권장소비자가 (₩)">
              <input
                type="number"
                min={0}
                value={form.recommendedRetailPrice}
                onChange={(e) =>
                  update(
                    'recommendedRetailPrice',
                    e.target.value === '' ? '' : Number(e.target.value),
                  )
                }
                placeholder="(선택)"
                className="input"
              />
            </Field>
          </div>
          {retail > 0 && supplyPrice > 0 && (
            <div className="mt-2 text-[11px] text-gray-500">
              가맹점 마진율 (소비자가 vs 공급가):{' '}
              <span className={retailMargin < 0 ? 'font-semibold text-red-600' : 'font-medium text-gray-700'}>
                {retailMargin.toFixed(2)}%
              </span>
            </div>
          )}
          <DateRangeRow
            startLabel="권장소비자가 적용 시작"
            endLabel="종료 (선택)"
            start={form.retailStartsAt}
            end={form.retailEndsAt}
            onStart={(v) => update('retailStartsAt', v)}
            onEnd={(v) => update('retailEndsAt', v)}
          />
          <p className="mt-3 text-[11px] text-gray-400">
            할인판매가 (가맹점 등급별/기간) / 프로모션가 / 1+1·2+1 물량할증은 별도 프로모션 관리에서 (다음
            chunk).
          </p>
        </div>

        {issues.length > 0 && (
          <div className="space-y-1">
            {issues.map((it, i) => (
              <div
                key={i}
                className={`rounded-lg px-3 py-2 text-xs ${
                  it.severity === 'error'
                    ? 'border border-red-200 bg-red-50 text-red-700'
                    : 'border border-amber-200 bg-amber-50 text-amber-700'
                }`}
              >
                {it.severity === 'error' ? '⛔' : '⚠️'} {it.message}
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function ReadOnlyRow({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="mt-3 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="font-mono font-semibold text-gray-900">
        ₩{value.toLocaleString()}
        {hint && <span className="ml-2 text-[10px] font-normal text-gray-400">{hint}</span>}
      </span>
    </div>
  );
}

function DateRangeRow({
  startLabel,
  endLabel,
  start,
  end,
  onStart,
  onEnd,
}: {
  startLabel: string;
  endLabel: string;
  start: string;
  end: string;
  onStart: (v: string) => void;
  onEnd: (v: string) => void;
}) {
  return (
    <div className="mt-3 grid gap-3 rounded-lg border border-dashed border-gray-200 p-3 md:grid-cols-2">
      <label className="block space-y-1">
        <span className="text-[11px] font-medium text-gray-600">
          {startLabel} <span className="text-gray-400">(공란 = 즉시 적용)</span>
        </span>
        <input
          type="date"
          value={start}
          onChange={(e) => onStart(e.target.value)}
          className="h-9 w-full rounded-lg border border-gray-300 px-2 text-xs"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-[11px] font-medium text-gray-600">
          {endLabel} <span className="text-gray-400">(공란 = 무기한)</span>
        </span>
        <input
          type="date"
          value={end}
          onChange={(e) => onEnd(e.target.value)}
          className="h-9 w-full rounded-lg border border-gray-300 px-2 text-xs"
        />
      </label>
    </div>
  );
}
