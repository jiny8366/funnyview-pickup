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
 * 토릭(toric): JINY 지시 — 구면(SPH)·난시(CYL)·난시축(AXIS) 3개를 화면 순서로 표시하되
 *              **순서 무관**하게 어느 항목을 먼저 골라도 제품 스펙(실제 variant 조합)에
 *              맞춰 나머지 드롭다운이 자동으로 좁혀진다(난시축이 주문요구와 맞는지 확인 후 주문).
 * 멀티포컬(multifocal): JINY 지시 — 가입도(ADD)는 제품 등급(HIGH/MID/MED 등)으로 구분되므로
 *              선택 UI가 아니라 **범위 안내 텍스트**만 표시. 선택은 SPH 하나로 끝.
 *
 * customer 용 VariantSelector 와 분리한 B2B 전용 선택기.
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
  const [qty, setQty] = useState(1);

  // 제품이 바뀌면(variants 교체) 선택 초기화
  useEffect(() => {
    setSph('');
    setCyl('');
    setAxis('');
    setQty(1);
  }, [variants]);

  const hasStock = (pred: (v: PickerVariant) => boolean) =>
    variants.some((v) => pred(v) && v.available > 0);

  // ── 토릭: 순서 무관(구면/난시/축 중 무엇을 골라도 스펙에 맞춰 나머지 필터) ──
  // 각 드롭다운 옵션 = "나머지 두 선택"에 부합하는 variant 들의 값(해당 차원 미선택은 제약 안 함).
  const matchExcept = (
    v: PickerVariant,
    sel: { s?: string; c?: string; a?: string },
  ) =>
    (!sel.s || v.sphere === sel.s) &&
    (!sel.c || v.cylinder === sel.c) &&
    (!sel.a || String(v.axis) === sel.a);

  const sphOptionsToric = useMemo(
    () => uniqSort(variants.filter((v) => matchExcept(v, { c: cyl, a: axis })).map((v) => v.sphere), 'desc'),
    [variants, cyl, axis],
  );
  const cylOptionsToric = useMemo(
    () =>
      uniqSort(
        variants
          .filter((v) => v.cylinder != null && matchExcept(v, { s: sph, a: axis }))
          .map((v) => v.cylinder as string),
        'desc',
      ),
    [variants, sph, axis],
  );
  const axisOptionsToric = useMemo(
    () =>
      uniqSort(
        variants
          .filter((v) => v.axis != null && matchExcept(v, { s: sph, c: cyl }))
          .map((v) => String(v.axis)),
      ),
    [variants, sph, cyl],
  );

  // 선택이 다른 선택 변경으로 더는 유효하지 않게 되면 정리(루프 없음 — 각 옵션은 자기 차원에 비의존).
  useEffect(() => {
    if (isToric && sph && !sphOptionsToric.includes(sph)) setSph('');
  }, [isToric, sph, sphOptionsToric]);
  useEffect(() => {
    if (isToric && cyl && !cylOptionsToric.includes(cyl)) setCyl('');
  }, [isToric, cyl, cylOptionsToric]);
  useEffect(() => {
    if (isToric && axis && !axisOptionsToric.includes(axis)) setAxis('');
  }, [isToric, axis, axisOptionsToric]);

  // ── 구면/멀티포컬: SPH 우선 ─────────────────────────────
  const sphOptions = useMemo(() => uniqSort(variants.map((v) => v.sphere), 'desc'), [variants]);
  // 멀티포컬 가입도 안내 — 제품 등급(HIGH/MID 등)으로 구분되므로 선택이 아닌 범위 표시 (JINY)
  const addValues = useMemo(
    () => uniqSort(variants.filter((v) => v.addPower != null).map((v) => v.addPower as string)),
    [variants],
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
      // ADD 는 제품으로 구분 — SPH 만으로 해석 (동일 SPH 복수 시 재고 있는 것 우선)
      if (!sph) return null;
      const candidates = variants.filter((v) => v.sphere === sph);
      return candidates.find((v) => v.available > 0) ?? candidates[0] ?? null;
    }
    if (!sph) return null;
    return (
      variants.find(
        (v) => v.sphere === sph && (v.cylinder == null || Number(v.cylinder) === 0),
      ) ?? null
    );
  }, [variants, isToric, isMulti, cyl, axis, sph]);

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
              <p className="text-[11px] text-gray-400">
                구면·난시·축을 순서와 무관하게 선택하면 제품 스펙에 맞춰 나머지가 자동으로 좁혀집니다.
              </p>
              {/* 구면(SPH) */}
              <select
                className={SELECT_CLASS}
                value={sph}
                onChange={(e) => setSph(e.target.value)}
              >
                <option value="">구면도수 (SPH) 선택</option>
                {sphOptionsToric.map((o) => {
                  const ok = hasStock((v) => matchExcept(v, { s: o, c: cyl, a: axis }));
                  return (
                    <option key={o} value={o} disabled={!ok}>
                      {fmtSph(o)}{ok ? '' : ' (품절)'}
                    </option>
                  );
                })}
              </select>

              {/* 난시도수(CYL) */}
              <select
                className={SELECT_CLASS}
                value={cyl}
                onChange={(e) => setCyl(e.target.value)}
              >
                <option value="">난시도수 (CYL) 선택</option>
                {cylOptionsToric.map((o) => {
                  const ok = hasStock((v) => matchExcept(v, { s: sph, c: o, a: axis }));
                  return (
                    <option key={o} value={o} disabled={!ok}>
                      {o}{ok ? '' : ' (품절)'}
                    </option>
                  );
                })}
              </select>

              {/* 난시축(AXIS) — 주문 요구와 맞는지 확인 */}
              <select
                className={SELECT_CLASS}
                value={axis}
                onChange={(e) => setAxis(e.target.value)}
              >
                <option value="">난시축 (AXIS) 선택</option>
                {axisOptionsToric.map((o) => {
                  const ok = hasStock((v) => matchExcept(v, { s: sph, c: cyl, a: o }));
                  return (
                    <option key={o} value={o} disabled={!ok}>
                      {o}{ok ? '' : ' (품절)'}
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
                onChange={(e) => setSph(e.target.value)}
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

              {/* 가입도(ADD)는 제품 등급(HIGH/MID/MED 등)으로 구분 — 선택이 아닌 범위 안내 (JINY) */}
              {isMulti && addValues.length > 0 && (
                <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                  가입도 (ADD):{' '}
                  <span className="font-semibold">
                    {addValues.length === 1
                      ? fmtSph(addValues[0])
                      : `${fmtSph(addValues[0])} ~ ${fmtSph(addValues[addValues.length - 1])}`}
                  </span>{' '}
                  — 이 제품의 등급에 포함된 가입도입니다 (별도 선택 불필요)
                </p>
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
            장바구니 담기
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
