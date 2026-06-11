'use client';

import { useEffect, useMemo, useState } from 'react';

export interface PickerVariant {
  variantId: string;
  sphere: string;
  cylinder: string | null;
  axis: number | null;
  addPower: string | null;
  available: number;
}

const SELECT_CLASS =
  'w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-900 focus:border-amber-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400';

function uniqSort(vals: string[], dir: 'asc' | 'desc' = 'asc'): string[] {
  const sorted = [...new Set(vals)].sort((a, b) => Number(a) - Number(b));
  return dir === 'desc' ? sorted.reverse() : sorted;
}

function fmtSph(s: string): string {
  return Number(s) > 0 ? `+${s}` : s;
}

/**
 * 가맹점 발주용 도수+수량 선택 패널.
 *
 * 구면(spherical): SPH 단일 드롭다운.
 * 토릭(toric): JINY 지시 — 난시(CYL) → 축(AXIS) → 구면(SPH) 순서로 선택.
 *              각 단계는 제품 variants 에 실제 존재하는 조합만 노출(스펙 인지).
 * 다초점(multifocal): SPH → ADD.
 *
 * customer 용 VariantSelector(SPH 우선) 와 토릭 순서가 충돌하므로 B2B 전용으로 분리.
 * 동일 필터링(스펙에 맞춰 좁히기) 로직은 동일하게 유지.
 */
export function StoreVariantPicker({
  variants,
  lensType,
  loading,
  onConfirm,
}: {
  variants: PickerVariant[];
  lensType: string;
  loading: boolean;
  onConfirm: (variant: PickerVariant, quantity: number) => void;
}) {
  const isToric = lensType === 'toric';
  const isMulti = lensType === 'multifocal';

  const [sph, setSph] = useState('');
  const [cyl, setCyl] = useState('');
  const [axis, setAxis] = useState('');
  const [add, setAdd] = useState('');
  const [qty, setQty] = useState(1);

  // 제품이 바뀌면(variants 교체) 선택 초기화
  useEffect(() => {
    setSph('');
    setCyl('');
    setAxis('');
    setAdd('');
    setQty(1);
  }, [variants]);

  const hasStock = (pred: (v: PickerVariant) => boolean) =>
    variants.some((v) => pred(v) && v.available > 0);

  // ── 토릭: CYL → AXIS → SPH ─────────────────────────────
  const cylOptions = useMemo(
    () => uniqSort(variants.filter((v) => v.cylinder != null).map((v) => v.cylinder as string), 'desc'),
    [variants],
  );
  const axisOptionsToric = useMemo(
    () => uniqSort(variants.filter((v) => v.cylinder === cyl && v.axis != null).map((v) => String(v.axis))),
    [variants, cyl],
  );
  const sphOptionsToric = useMemo(
    () =>
      uniqSort(
        variants
          .filter((v) => v.cylinder === cyl && String(v.axis) === axis)
          .map((v) => v.sphere),
        'desc',
      ),
    [variants, cyl, axis],
  );

  // ── 구면/다초점: SPH 우선 ─────────────────────────────
  const sphOptions = useMemo(() => uniqSort(variants.map((v) => v.sphere), 'desc'), [variants]);
  const addOptions = useMemo(
    () => uniqSort(variants.filter((v) => v.sphere === sph && v.addPower != null).map((v) => v.addPower as string)),
    [variants, sph],
  );

  // 현재 선택 → variant 해석
  const selected = useMemo<PickerVariant | null>(() => {
    if (isToric) {
      if (!cyl || !axis || !sph) return null;
      return (
        variants.find(
          (v) => v.cylinder === cyl && String(v.axis) === axis && v.sphere === sph,
        ) ?? null
      );
    }
    if (isMulti) {
      if (!sph || !add) return null;
      return variants.find((v) => v.sphere === sph && v.addPower === add) ?? null;
    }
    if (!sph) return null;
    return (
      variants.find(
        (v) => v.sphere === sph && (v.cylinder == null || Number(v.cylinder) === 0),
      ) ?? null
    );
  }, [variants, isToric, isMulti, cyl, axis, sph, add]);

  const canConfirm = selected != null && qty >= 1;

  return (
    <div className="space-y-3">
      {loading ? (
        <p className="py-6 text-center text-sm text-gray-400">도수 불러오는 중…</p>
      ) : variants.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">등록된 도수가 없습니다.</p>
      ) : (
        <div className="space-y-2.5">
          {isToric ? (
            <>
              <select
                className={SELECT_CLASS}
                value={cyl}
                onChange={(e) => {
                  setCyl(e.target.value);
                  setAxis('');
                  setSph('');
                }}
              >
                <option value="" disabled>
                  난시도수 (CYL)
                </option>
                {cylOptions.map((o) => {
                  const ok = hasStock((v) => v.cylinder === o);
                  return (
                    <option key={o} value={o} disabled={!ok}>
                      {o}{ok ? '' : ' (품절)'}
                    </option>
                  );
                })}
              </select>

              <select
                className={SELECT_CLASS}
                value={axis}
                disabled={!cyl}
                onChange={(e) => {
                  setAxis(e.target.value);
                  setSph('');
                }}
              >
                <option value="" disabled>
                  난시축 (AXIS)
                </option>
                {axisOptionsToric.map((o) => {
                  const ok = hasStock((v) => v.cylinder === cyl && String(v.axis) === o);
                  return (
                    <option key={o} value={o} disabled={!ok}>
                      {o}{ok ? '' : ' (품절)'}
                    </option>
                  );
                })}
              </select>

              <select
                className={SELECT_CLASS}
                value={sph}
                disabled={!axis}
                onChange={(e) => setSph(e.target.value)}
              >
                <option value="" disabled>
                  구면도수 (SPH)
                </option>
                {sphOptionsToric.map((o) => {
                  const ok = hasStock(
                    (v) => v.cylinder === cyl && String(v.axis) === axis && v.sphere === o,
                  );
                  return (
                    <option key={o} value={o} disabled={!ok}>
                      {fmtSph(o)}{ok ? '' : ' (품절)'}
                    </option>
                  );
                })}
              </select>
            </>
          ) : (
            <>
              <select
                className={SELECT_CLASS}
                value={sph}
                onChange={(e) => {
                  setSph(e.target.value);
                  setAdd('');
                }}
              >
                <option value="" disabled>
                  구면도수 (SPH)
                </option>
                {sphOptions.map((o) => {
                  const ok = hasStock((v) => v.sphere === o);
                  return (
                    <option key={o} value={o} disabled={!ok}>
                      {fmtSph(o)}{ok ? '' : ' (품절)'}
                    </option>
                  );
                })}
              </select>

              {isMulti && (
                <select
                  className={SELECT_CLASS}
                  value={add}
                  disabled={!sph}
                  onChange={(e) => setAdd(e.target.value)}
                >
                  <option value="" disabled>
                    가입도 (ADD)
                  </option>
                  {addOptions.map((o) => {
                    const ok = hasStock((v) => v.sphere === sph && v.addPower === o);
                    return (
                      <option key={o} value={o} disabled={!ok}>
                        {o}{ok ? '' : ' (품절)'}
                      </option>
                    );
                  })}
                </select>
              )}
            </>
          )}

          {/* 수량 — 도수 선택 옆 */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs font-medium text-gray-500">수량</span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="grid h-8 w-8 place-items-center rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              −
            </button>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value)) || 1))}
              className="w-14 rounded border border-gray-300 bg-white py-1.5 text-center text-sm text-gray-900"
            />
            <button
              type="button"
              onClick={() => setQty((q) => q + 1)}
              className="grid h-8 w-8 place-items-center rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              +
            </button>
          </div>

          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => selected && onConfirm(selected, qty)}
            className="mt-1 w-full rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            발주 담기
          </button>
        </div>
      )}
    </div>
  );
}

/** 도수 스냅샷 → 사람이 읽는 라벨 (예: SPH +1.00 / CYL -0.75 / AXIS 180). */
export function powerLabel(p: {
  sphere: string | null;
  cylinder: string | null;
  axis: number | null;
  addPower: string | null;
}): string {
  const parts: string[] = [];
  if (p.sphere != null && p.sphere !== '') parts.push(`SPH ${fmtSph(p.sphere)}`);
  if (p.cylinder != null && p.cylinder !== '' && Number(p.cylinder) !== 0) {
    parts.push(`CYL ${p.cylinder}`);
  }
  if (p.axis != null) parts.push(`AXIS ${p.axis}`);
  if (p.addPower != null && p.addPower !== '') parts.push(`ADD ${p.addPower}`);
  return parts.join(' · ');
}
