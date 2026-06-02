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

function uniqSortNum(vals: string[]): string[] {
  return [...new Set(vals)].sort((a, b) => Number(a) - Number(b));
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

  const sphOptions = useMemo(() => uniqSortNum(variants.map((v) => v.sphere)), [variants]);
  const cylOptions = useMemo(
    () => uniqSortNum(variants.filter((v) => v.sphere === sph && v.cylinder != null).map((v) => v.cylinder as string)),
    [variants, sph],
  );
  const axisOptions = useMemo(
    () =>
      uniqSortNum(
        variants.filter((v) => v.sphere === sph && v.cylinder === cyl && v.axis != null).map((v) => String(v.axis)),
      ),
    [variants, sph, cyl],
  );
  const addOptions = useMemo(
    () => uniqSortNum(variants.filter((v) => v.sphere === sph && v.addPower != null).map((v) => v.addPower as string)),
    [variants, sph],
  );

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
      <Field label="구면도수 (SPH)">
        <select className={SELECT_CLASS} value={sph} onChange={(e) => {
          const s = e.target.value;
          setSph(s);
          setCyl('');
          setAxis('');
          setAdd('');
          resolve(s, '', '', '');
        }}>
          <option value="" disabled>
            구면도수를 선택하세요
          </option>
          {sphOptions.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </Field>

      {isToric && (
        <>
          <Field label="난시도수 (CYL)">
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
                {sph ? '난시도수를 선택하세요' : '구면도수를 먼저 선택하세요'}
              </option>
              {cylOptions.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </Field>

          <Field label="난시축 (AXIS)">
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
                {cyl ? '난시축을 선택하세요' : '난시도수를 먼저 선택하세요'}
              </option>
              {axisOptions.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </Field>
        </>
      )}

      {isMulti && (
        <Field label="가입도 (ADD)">
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
              {sph ? '가입도를 선택하세요' : '구면도수를 먼저 선택하세요'}
            </option>
            {addOptions.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </Field>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold text-gray-500">{label}</p>
      {children}
    </div>
  );
}
