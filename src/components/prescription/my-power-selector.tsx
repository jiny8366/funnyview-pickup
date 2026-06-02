'use client';

import Link from 'next/link';
import { useState } from 'react';
import { RecommendModal } from '@/components/prescription/recommend-modal';
import { formatDiopter, roundQuarter } from '@/lib/prescription/convert';

interface Variant {
  variantId: string;
  sphere: string;
  cylinder: string | null;
  axis: number | null;
  addPower: string | null;
  available: number;
}

interface Presc {
  eyeSide: 'left' | 'right';
  kind: string;
  sphere: number;
  cylinder: number | null;
  axis: number | null;
  addPower: number | null;
}

const ASTIGMATISM_MIN = 0.5;

function doseLabel(p: Presc): string {
  let s = `SPH ${formatDiopter(p.sphere)}`;
  if (p.cylinder != null && Math.abs(p.cylinder) >= ASTIGMATISM_MIN) {
    s += ` · CYL ${formatDiopter(p.cylinder)}`;
    if (p.axis != null) s += ` · AX ${p.axis}`;
  }
  if (p.addPower != null && p.addPower > 0) s += ` · ADD ${formatDiopter(p.addPower)}`;
  return s;
}

/** 제품 variants 에서 도수를 정확히 충족하는 variant 찾기 (재고 있는 것 우선). */
function findExact(variants: Variant[], sphere: number, cyl: number | null, axis: number | null): Variant | null {
  const astig = cyl != null && Math.abs(cyl) >= ASTIGMATISM_MIN;
  const sorted = [...variants].sort((a, b) => (b.available > 0 ? 1 : 0) - (a.available > 0 ? 1 : 0));
  for (const v of sorted) {
    if (Number(v.sphere) !== sphere) continue;
    if (astig) {
      if (v.cylinder == null) continue;
      if (Number(v.cylinder) !== cyl) continue;
      if (axis != null && v.axis != null && v.axis !== axis) continue;
      return v;
    }
    if (v.cylinder == null || Number(v.cylinder) === 0) return v;
  }
  return null;
}

/**
 * '내 도수 선택' — 로그인 고객의 저장 도수(선택한 눈)를 불러와 이 제품에서 충족하는 도수를 자동선택.
 * 미충족 시 경고 → ⓐ 맞는 제품 추천(모달) / ⓑ 난시 구면등가 변환 자동선택 안내.
 */
export function MyPowerSelector({
  variants,
  eyeSide,
  onSelect,
}: {
  variants: Variant[];
  eyeSide: 'left' | 'right';
  onSelect: (variantId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [step, setStep] = useState<'idle' | 'warn' | 'options'>('idle');
  const [presc, setPresc] = useState<Presc | null>(null);
  const [recommendOpen, setRecommendOpen] = useState(false);

  async function loadMyPower() {
    setBusy(true);
    setMsg(null);
    setNeedLogin(false);
    try {
      const res = await fetch('/api/customer/prescriptions');
      if (res.status === 401) {
        setNeedLogin(true);
        return;
      }
      const j = await res.json().catch(() => ({}));
      const list: Presc[] = (j?.prescriptions ?? [])
        .filter((p: { eyeSide: string }) => p.eyeSide === eyeSide)
        .map((p: Record<string, unknown>) => ({
          eyeSide: p.eyeSide as 'left' | 'right',
          kind: String(p.kind ?? 'contact'),
          sphere: Number(p.sphere),
          cylinder: p.cylinder != null ? Number(p.cylinder) : null,
          axis: p.axis != null ? Number(p.axis) : null,
          addPower: p.addPower != null ? Number(p.addPower) : null,
        }));
      if (list.length === 0) {
        setMsg('저장된 도수가 없습니다. 마이페이지에서 시력정보를 입력해 주세요.');
        return;
      }
      const p = list[0];
      setPresc(p);
      const match = findExact(variants, p.sphere, p.cylinder, p.axis);
      if (match) {
        onSelect(match.variantId);
        setMsg(`내 도수로 선택했습니다 · ${doseLabel(p)}`);
      } else {
        setStep('warn');
      }
    } catch {
      setMsg('도수를 불러오지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  function applySphericalEquivalent() {
    if (!presc) return;
    const seSphere = roundQuarter(presc.sphere + (presc.cylinder ?? 0) / 2);
    const match = findExact(variants, seSphere, null, null);
    if (match) {
      onSelect(match.variantId);
      setStep('idle');
      setMsg(`난시를 구면등가로 변환해 SPH ${formatDiopter(seSphere)} 도수로 선택했습니다.`);
    } else {
      setMsg('이 제품에는 구면등가 도수도 없습니다. 맞는 제품 추천을 이용해 주세요.');
      setStep('options');
    }
  }

  const closeModal = () => setStep('idle');

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={loadMyPower}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-brand-300 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 disabled:opacity-60"
      >
        👁 {busy ? '불러오는 중...' : '내 도수 선택'}
      </button>

      {msg && <p className="mt-1.5 text-xs text-gray-500">{msg}</p>}
      {needLogin && (
        <p className="mt-1.5 text-xs text-gray-500">
          저장된 도수를 쓰려면{' '}
          <Link href="/login" className="font-medium text-brand-600 underline">
            로그인
          </Link>{' '}
          후 마이페이지에서 시력정보를 입력해 주세요.
        </p>
      )}

      {step !== 'idle' && presc && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={closeModal}>
          <div
            className="w-full max-w-sm rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {step === 'warn' ? (
              <>
                <p className="text-base font-bold text-gray-900">맞는 도수가 없습니다</p>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  이 제품은 회원님의 도수({doseLabel(presc)})를 제공하지 않습니다.
                </p>
                <button
                  type="button"
                  onClick={() => setStep('options')}
                  className="mt-5 w-full rounded-lg bg-gray-900 py-3 text-sm font-semibold text-white hover:bg-gray-800"
                >
                  확인
                </button>
              </>
            ) : (
              <>
                <p className="text-base font-bold text-gray-900">어떻게 도와드릴까요?</p>
                {msg && <p className="mt-2 text-xs text-amber-600">{msg}</p>}
                <button
                  type="button"
                  onClick={() => {
                    setStep('idle');
                    setRecommendOpen(true);
                  }}
                  className="mt-4 w-full rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  맞는 도수를 제공하는 제품을 추천받기
                </button>
                <button
                  type="button"
                  onClick={applySphericalEquivalent}
                  className="mt-2 w-full rounded-lg border border-gray-300 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                >
                  난시를 구면등가로 변환해 이 제품으로 예약
                </button>
                <button type="button" onClick={closeModal} className="mt-3 w-full py-2 text-xs text-gray-400 hover:text-gray-600">
                  닫기
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {presc && (
        <RecommendModal
          open={recommendOpen}
          onClose={() => setRecommendOpen(false)}
          endpoint="/api/customer/recommend"
          dose={{ sphere: presc.sphere, cylinder: presc.cylinder, addPower: presc.addPower }}
        />
      )}
    </div>
  );
}
