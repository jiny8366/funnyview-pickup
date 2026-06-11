'use client';

import Link from 'next/link';
import { useState } from 'react';
import { RecommendModal } from '@/components/prescription/recommend-modal';
import { formatDiopter, glassesToContactToric, roundQuarter } from '@/lib/prescription/convert';

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

/** 저장 도수 후보 — 안경 도수는 콘택트 환산값으로 보관, 출처·저장일을 구분 표시. */
interface Candidate extends Presc {
  fromGlasses: boolean;
  recordedAt: string;
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
  const [step, setStep] = useState<'idle' | 'warn' | 'options' | 'addChoice' | 'pick'>('idle');
  const [presc, setPresc] = useState<Presc | null>(null);
  const [cands, setCands] = useState<Candidate[]>([]);
  const [recommendOpen, setRecommendOpen] = useState(false);

  // 이 제품이 멀티포컬(ADD 변형 보유)/난시(토릭 변형 보유) 제품인지 —
  // ADD 는 옵션이라 비멀티포컬에서 매칭을 막지 않고, 저장 도수가 여럿이면 제품 유형에 맞는 도수를 기본으로 한다.
  const productHasAdd = variants.some((v) => v.addPower != null && Number(v.addPower) > 0);
  const productIsToric = variants.some((v) => v.cylinder != null && Math.abs(Number(v.cylinder)) >= ASTIGMATISM_MIN);

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
      if (!res.ok) {
        setMsg('도수 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
        return;
      }
      const j = await res.json().catch(() => ({}));
      // API 는 그룹 형태 {recordedAt, kind, left:{sphere…}|null, right:{…}|null} (최신순).
      // 현재 눈(eyeSide)의 데이터가 있는 그룹을 후보로 평면화하고, 안경 도수는 콘택트로 환산해 보관
      // (미변환 안경도수를 콘택트 variant 에 직접 매칭하면 안 됨 — 도수가 다름).
      type EyeData = { sphere: string | number; cylinder: string | number | null; axis: number | null; addPower: string | number | null };
      const flat: Candidate[] = ((j?.prescriptions ?? []) as Array<Record<string, unknown>>)
        .flatMap((g) => {
          const eye = g[eyeSide] as EyeData | null | undefined;
          if (!eye || eye.sphere == null) return [];
          const kind = String(g.kind ?? 'contact');
          const raw = {
            sphere: Number(eye.sphere),
            cylinder: eye.cylinder != null ? Number(eye.cylinder) : null,
            axis: eye.axis != null ? Number(eye.axis) : null,
            addPower: eye.addPower != null ? Number(eye.addPower) : null,
          };
          const fromGlasses = kind !== 'contact';
          const dose = fromGlasses ? glassesToContactToric(raw) : raw;
          return [{
            eyeSide,
            kind: 'contact',
            sphere: dose.sphere,
            cylinder: dose.cylinder,
            axis: dose.axis,
            addPower: dose.addPower,
            fromGlasses,
            recordedAt: String(g.recordedAt ?? ''),
          }];
        });
      // 동일 도수(환산 후) 중복 제거 — 최신 것만 유지(목록이 최신순)
      const seen = new Set<string>();
      const candidates = flat.filter((c) => {
        const key = `${c.sphere}|${c.cylinder}|${c.axis}|${c.addPower}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (candidates.length === 0) {
        setMsg('저장된 도수가 없습니다. 마이페이지에서 시력정보를 입력해 주세요.');
        return;
      }
      if (candidates.length === 1) {
        applyCandidate(candidates[0]);
        return;
      }
      // 저장 도수가 여럿이면 — 최근 것을 무조건 쓰지 않고 고객이 선택(JINY 정책).
      // 제품 유형에 맞는 도수(난시 제품=난시 포함, 멀티포컬=ADD 포함)를 위로 정렬해 기본 안내.
      const fit = (c: Candidate) => {
        const astig = c.cylinder != null && Math.abs(c.cylinder) >= ASTIGMATISM_MIN;
        const hasAdd = c.addPower != null && c.addPower > 0;
        let score = 0;
        if (productIsToric && astig) score += 2;
        if (productHasAdd && hasAdd) score += 2;
        if (!productIsToric && !astig) score += 1;
        return score;
      };
      setCands([...candidates].sort((a, b) => fit(b) - fit(a)));
      setStep('pick');
    } catch {
      setMsg('도수를 불러오지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  /** 선택된 저장 도수를 이 제품에 적용 — ADD 안내/매칭 공통 파이프라인. */
  function applyCandidate(c: Candidate) {
    const p: Presc = { eyeSide: c.eyeSide, kind: 'contact', sphere: c.sphere, cylinder: c.cylinder, axis: c.axis, addPower: c.addPower };
    setPresc(p);
    const hasAdd = p.addPower != null && p.addPower > 0;

    // 처방에 ADD(돋보기) 가 있는데 이 제품이 멀티포컬이 아니면 — 차단하지 말고 고객이 선택:
    // 멀티포컬 추천을 받을지, 그냥 구면(이 제품)으로 갈지. (JINY 정책: ADD 는 옵션)
    if (hasAdd && !productHasAdd) {
      setStep('addChoice');
      return;
    }

    // 멀티포컬 제품 + ADD 보유: ADD 까지 일치하는 변형을 우선 매칭
    const pool = hasAdd && productHasAdd
      ? variants.filter((v) => v.addPower != null && Number(v.addPower) === p.addPower)
      : variants;
    const match = findExact(pool.length > 0 ? pool : variants, p.sphere, p.cylinder, p.axis);
    if (match) {
      onSelect(match.variantId);
      setStep('idle');
      setMsg(`${c.fromGlasses ? '안경도수를 콘택트로 변환해 ' : '내 도수로 '}선택했습니다 · ${doseLabel(p)}`);
    } else {
      setStep('warn');
    }
  }

  /** ADD 안내창에서 '그냥 이 제품(구면)으로' 선택 — ADD 무시하고 SPH/CYL 로 매칭. */
  function continueWithoutAdd() {
    if (!presc) return;
    const match = findExact(variants, presc.sphere, presc.cylinder, presc.axis);
    if (match) {
      onSelect(match.variantId);
      setStep('idle');
      setMsg(`내 도수로 선택했습니다 · ${doseLabel({ ...presc, addPower: null })}`);
    } else {
      setStep('warn');
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

      {step !== 'idle' && (step === 'pick' ? cands.length > 0 : presc != null) && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={closeModal}>
          <div
            className="w-full max-w-sm animate-slide-up rounded-t-2xl bg-white p-6 shadow-pop sm:animate-scale-in sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {step === 'pick' ? (
              <>
                <p className="text-base font-bold text-gray-900">어떤 도수로 적용할까요?</p>
                <p className="mt-1 text-xs text-gray-500">
                  저장된 도수가 여러 개입니다. {productIsToric ? '이 제품은 난시(토릭) 렌즈라 난시 포함 도수를 권장합니다.' : '적용할 도수를 선택해 주세요.'}
                </p>
                <div className="mt-4 space-y-2">
                  {cands.slice(0, 5).map((c, i) => {
                    const astig = c.cylinder != null && Math.abs(c.cylinder) >= ASTIGMATISM_MIN;
                    const tags = [
                      astig ? '난시' : '구면',
                      ...(c.addPower != null && c.addPower > 0 ? ['멀티포컬(ADD)'] : []),
                      ...(c.fromGlasses ? ['안경 변환'] : []),
                    ];
                    const recommended = (productIsToric && astig) || (productHasAdd && c.addPower != null && c.addPower > 0);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => { setStep('idle'); applyCandidate(c); }}
                        className={`tap w-full rounded-xl border px-4 py-3 text-left transition hover:border-brand-400 ${recommended ? 'border-brand-300 bg-brand-50' : 'border-gray-200 bg-white'}`}
                      >
                        <span className="flex items-center gap-1.5 text-[11px]">
                          {tags.map((t) => (
                            <span key={t} className="rounded-full border border-gray-300 px-2 py-0.5 text-gray-600">{t}</span>
                          ))}
                          {recommended && <span className="ml-auto font-semibold text-brand-600">이 제품에 맞음</span>}
                        </span>
                        <span className="mt-1 block text-sm font-semibold text-gray-900">{doseLabel(c)}</span>
                        {c.recordedAt && (
                          <span className="mt-0.5 block text-[10px] text-gray-400">{new Date(c.recordedAt).toLocaleDateString('ko-KR')} 저장</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <button type="button" onClick={closeModal} className="mt-3 w-full py-2 text-xs text-gray-400 hover:text-gray-600">
                  닫기
                </button>
              </>
            ) : step === 'addChoice' && presc ? (
              <>
                <p className="text-base font-bold text-gray-900">근거리 보기가 편하시려면 멀티포컬 렌즈를 선택하세요.</p>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  저장된 도수에 돋보기(ADD {presc.addPower != null ? formatDiopter(presc.addPower) : ''}) 값이 있어요.
                  이 제품은 멀티포컬(다초점)이 아니지만, 원하시면 그대로 선택할 수 있습니다.
                </p>
                <button
                  type="button"
                  onClick={() => { setStep('idle'); setRecommendOpen(true); }}
                  className="mt-5 w-full rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  멀티포컬 추천렌즈 안내받기
                </button>
                <button
                  type="button"
                  onClick={continueWithoutAdd}
                  className="mt-2 w-full rounded-lg border border-gray-300 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                >
                  그냥 이 제품(구면)으로 선택
                </button>
                <button type="button" onClick={closeModal} className="mt-3 w-full py-2 text-xs text-gray-400 hover:text-gray-600">
                  닫기
                </button>
              </>
            ) : step === 'warn' ? (
              <>
                <p className="text-base font-bold text-gray-900">맞는 도수가 없습니다</p>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  이 제품은 회원님의 도수({presc ? doseLabel(presc) : ''})를 제공하지 않습니다.
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
