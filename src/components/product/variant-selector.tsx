'use client';

import { useEffect, useMemo, useState } from 'react';

interface Variant {
  variantId: string;
  sphere: string;
  cylinder: string | null;
  axis: number | null;
  addPower: string | null;
  available: number;
}

const SELECT_CLASS =
  'w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 focus:border-gray-900 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400';

function uniqSort(vals: string[], dir: 'asc' | 'desc' = 'asc'): string[] {
  const sorted = [...new Set(vals)].sort((a, b) => Number(a) - Number(b));
  return dir === 'desc' ? sorted.reverse() : sorted;
}

/**
 * 도수 선택 — 토릭은 구면(SPH)→난시(CYL)→난시축(AXIS) 종속 선택, 다초점은 SPH→ADD.
 * 각 단계는 제품 variants 에 실제 존재하는 값만 노출(이전 단계 선택에 따라 좁혀짐).
 * 외부에서 variantId 가 설정되면('내 도수 선택' 등) 해당 도수로 동기화.
 */
export function VariantSelector({
  variants,
  lensType,
  variantId,
  onChange,
}: {
  variants: Variant[];
  lensType: string;
  variantId: string | null;
  onChange: (id: string | null) => void;
}) {
  const isToric = lensType === 'toric';
  const isMulti = lensType === 'multifocal';

  const [sph, setSph] = useState('');
  const [cyl, setCyl] = useState('');
  const [axis, setAxis] = useState('');
  const [add, setAdd] = useState('');

  // 외부 variantId 동기화 (내 도수 선택 등). null 이면 부분 선택 중이므로 유지.
  useEffect(() => {
    if (variantId == null) return;
    const v = variants.find((x) => x.variantId === variantId);
    if (v) {
      setSph(v.sphere);
      setCyl(v.cylinder ?? '');
      setAxis(v.axis != null ? String(v.axis) : '');
      setAdd(v.addPower ?? '');
    }
  }, [variantId, variants]);

  // 구면도수: 0.00 기준 위로 원시(+), 아래로 근시(−) → 내림차순(+ 위 / − 아래)
  const sphOptions = useMemo(() => uniqSort(variants.map((v) => v.sphere), 'desc'), [variants]);
  // 난시도수: 낮은 난시(−0.75)부터 → 내림차순(절댓값 작은 것 먼저)
  const cylOptions = useMemo(
    () => uniqSort(variants.filter((v) => v.sphere === sph && v.cylinder != null).map((v) => v.cylinder as string), 'desc'),
    [variants, sph],
  );
  const axisOptions = useMemo(
    () =>
      uniqSort(
        variants.filter((v) => v.sphere === sph && v.cylinder === cyl && v.axis != null).map((v) => String(v.axis)),
      ),
    [variants, sph, cyl],
  );
  const addOptions = useMemo(
    () => uniqSort(variants.filter((v) => v.sphere === sph && v.addPower != null).map((v) => v.addPower as string)),
    [variants, sph],
  );

  // 해당 도수 조건에 재고(available>0) 있는 variant 가 하나라도 있나 — 품절 표기·disable 용
  const hasStock = (pred: (v: Variant) => boolean) => variants.some((v) => pred(v) && v.available > 0);

  function resolve(s: string, c: string, a: string, d: string) {
    if (!s) {
      onChange(null);
      return;
    }
    const m = variants.find((v) => {
      if (v.sphere !== s) return false;
      if (isToric) return Boolean(c) && Boolean(a) && v.cylinder === c && String(v.axis) === a;
      if (isMulti) return Boolean(d) && v.addPower === d;
      return v.cylinder == null || Number(v.cylinder) === 0;
    });
    onChange(m ? m.variantId : null);
  }

  return (
    <div className="space-y-2.5">
      <select
        className={SELECT_CLASS}
        value={sph}
        onChange={(e) => {
          const s = e.target.value;
          setSph(s);
          setCyl('');
          setAxis('');
          setAdd('');
          resolve(s, '', '', '');
        }}
      >
        <option value="" disabled>
          구면도수 (SPH)
        </option>
        {sphOptions.map((o) => {
          const ok = hasStock((v) => v.sphere === o);
          return (
            <option key={o} value={o} disabled={!ok}>
              {Number(o) > 0 ? `+${o}` : o}{ok ? '' : ' (품절)'}
            </option>
          );
        })}
      </select>

      {isToric && (
        <>
          <select
            className={SELECT_CLASS}
            value={cyl}
            disabled={!sph}
            onChange={(e) => {
              const c = e.target.value;
              setCyl(c);
              setAxis('');
              resolve(sph, c, '', add);
            }}
          >
            <option value="" disabled>
              난시도수 (CYL)
            </option>
            {cylOptions.map((o) => {
              const ok = hasStock((v) => v.sphere === sph && v.cylinder === o);
              return (
                <option key={o} value={o} disabled={!ok}>{o}{ok ? '' : ' (품절)'}</option>
              );
            })}
          </select>

          <select
            className={SELECT_CLASS}
            value={axis}
            disabled={!cyl}
            onChange={(e) => {
              const a = e.target.value;
              setAxis(a);
              resolve(sph, cyl, a, add);
            }}
          >
            <option value="" disabled>
              난시축 (AXIS)
            </option>
            {axisOptions.map((o) => {
              const ok = hasStock((v) => v.sphere === sph && v.cylinder === cyl && String(v.axis) === o);
              return (
                <option key={o} value={o} disabled={!ok}>{o}{ok ? '' : ' (품절)'}</option>
              );
            })}
          </select>
        </>
      )}

      {isMulti && (
        <select
          className={SELECT_CLASS}
          value={add}
          disabled={!sph}
          onChange={(e) => {
            const d = e.target.value;
            setAdd(d);
            resolve(sph, cyl, axis, d);
          }}
        >
          <option value="" disabled>
            가입도 (ADD)
          </option>
          {addOptions.map((o) => {
            const ok = hasStock((v) => v.sphere === sph && v.addPower === o);
            return (
              <option key={o} value={o} disabled={!ok}>{o}{ok ? '' : ' (품절)'}</option>
            );
          })}
        </select>
      )}
    </div>
  );
}
