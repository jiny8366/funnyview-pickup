'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  formatDiopter,
  glassesToContactSphericalEquivalent,
  glassesToContactToric,
  normalizeAddDiopter,
  normalizeAxis,
  normalizeSignedDiopter,
  signedDiopterString,
} from '@/lib/prescription/convert';
import { RecommendModal, type RecommendDose } from './recommend-modal';

type Kind = 'glasses' | 'contact';
type Source = 'manual' | 'converted' | 'se';

interface EyeData {
  sphere: string;
  cylinder: string | null;
  axis: number | null;
  addPower: string | null;
}
interface PrescriptionGroup {
  recordedAt: string;
  kind: Kind;
  source: string | null;
  left: EyeData | null;
  right: EyeData | null;
}

interface EyeForm {
  sphere: string;
  cylinder: string;
  axis: string;
  addPower: string;
}
const EMPTY_EYE: EyeForm = { sphere: '', cylinder: '', axis: '', addPower: '' };

function eyeDataToForm(e: EyeData | null): EyeForm {
  if (!e) return EMPTY_EYE;
  return {
    sphere: e.sphere ?? '',
    cylinder: e.cylinder ?? '',
    axis: e.axis !== null ? String(e.axis) : '',
    addPower: e.addPower ?? '',
  };
}

/** 추천 기준 도수 — 좌/우 중 절댓값이 큰 눈을 대표로. */
function groupToDose(g: PrescriptionGroup): RecommendDose {
  const eyes = [g.right, g.left].filter((e): e is EyeData => e !== null);
  if (eyes.length === 0) return { sphere: 0, cylinder: null, addPower: null };
  let pick = eyes[0];
  for (const e of eyes) {
    if (Math.abs(Number(e.sphere)) > Math.abs(Number(pick.sphere))) pick = e;
  }
  return {
    sphere: Number(pick.sphere),
    cylinder: pick.cylinder ? Number(pick.cylinder) : null,
    addPower: pick.addPower ? Number(pick.addPower) : null,
  };
}

/**
 * 고객 시력(도수) 관리 — admin/customer/store 공용.
 * 안경·콘택트 입력을 함께 표시. 변환 버튼은 안경 도수를 콘택트 칸에 채워 넣기만 하고(저장 X),
 * 저장 버튼이 안경·콘택트 입력값을 한 번에 기록한다. 이력 항목 클릭으로 수정 가능.
 */
export function PrescriptionManager({
  endpoint,
  canEdit,
  recommendEndpoint,
}: {
  endpoint: string;
  canEdit: boolean;
  recommendEndpoint?: string;
}) {
  const [groups, setGroups] = useState<PrescriptionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [gRight, setGRight] = useState<EyeForm>(EMPTY_EYE);
  const [gLeft, setGLeft] = useState<EyeForm>(EMPTY_EYE);
  const [gEditAt, setGEditAt] = useState<string | null>(null);
  const [cRight, setCRight] = useState<EyeForm>(EMPTY_EYE);
  const [cLeft, setCLeft] = useState<EyeForm>(EMPTY_EYE);
  const [cEditAt, setCEditAt] = useState<string | null>(null);
  const [cSource, setCSource] = useState<Source>('manual');
  const [recommendDose, setRecommendDose] = useState<RecommendDose | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(endpoint)
      .then((r) => (r.ok ? r.json() : { prescriptions: [] }))
      .then((j) => setGroups(j.prescriptions ?? []))
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, [endpoint]);

  useEffect(() => {
    load();
  }, [load]);

  function eyePayload(f: EyeForm) {
    const sphere = normalizeSignedDiopter(f.sphere);
    if (!sphere) return null;
    // CYL/ADD: 0 또는 빈 값은 null 로 통일 (no-correction).
    // axis 는 CYL 이 의미 있을 때만 보존.
    const cylRaw = normalizeSignedDiopter(f.cylinder);
    const cylinder = !cylRaw || Number(cylRaw) === 0 ? null : cylRaw;
    const addRaw = normalizeAddDiopter(f.addPower);
    const addPower = !addRaw || Number(addRaw) === 0 ? null : addRaw;
    const axisStr = normalizeAxis(f.axis);
    const axis = cylinder == null ? null : axisStr ? Number(axisStr) : null;
    return {
      sphere,
      cylinder,
      axis,
      addPower,
    };
  }

  function flash(setter: (v: string | null) => void, text: string) {
    setter(text);
    setTimeout(() => setter(null), 3000);
  }

  async function post(body: Record<string, unknown>): Promise<boolean> {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  }

  function contactFormFromGlasses(
    p: NonNullable<ReturnType<typeof eyePayload>>,
    mode: 'toric' | 'se',
  ): EyeForm {
    const input = {
      sphere: Number(p.sphere),
      cylinder: p.cylinder ? Number(p.cylinder) : null,
      axis: p.axis,
      addPower: p.addPower ? Number(p.addPower) : null,
    };
    const r = mode === 'se'
      ? glassesToContactSphericalEquivalent(input)
      : glassesToContactToric(input);
    return {
      sphere: signedDiopterString(r.sphere),
      cylinder: r.cylinder !== null ? signedDiopterString(r.cylinder) : '',
      axis: r.axis !== null ? String(r.axis) : '',
      addPower: r.addPower !== null ? '+' + Math.abs(r.addPower).toFixed(2) : '',
    };
  }

  // 변환 — 콘택트 칸을 채우기만 (저장은 별도)
  function convert(mode: 'toric' | 'se') {
    setErr(null);
    const r = eyePayload(gRight);
    const l = eyePayload(gLeft);
    if (!r && !l) {
      setErr('변환할 안경 도수를 먼저 입력하세요.');
      return;
    }
    setCRight(r ? contactFormFromGlasses(r, mode) : EMPTY_EYE);
    setCLeft(l ? contactFormFromGlasses(l, mode) : EMPTY_EYE);
    setCSource(mode === 'se' ? 'se' : 'converted');
    flash(
      setMsg,
      mode === 'se'
        ? '구면등가 도수로 변환했습니다. 확인 후 저장하세요.'
        : '난시용(토릭) 콘택트 도수로 변환했습니다. 확인 후 저장하세요.',
    );
  }

  // 저장 — 안경·콘택트 입력값을 모두 기록 (편집 중이면 해당 기록 교체)
  async function handleSave() {
    setErr(null);
    const gr = eyePayload(gRight);
    const gl = eyePayload(gLeft);
    const cr = eyePayload(cRight);
    const cl = eyePayload(cLeft);
    if (!gr && !gl && !cr && !cl) {
      setErr('저장할 도수를 입력하세요.');
      return;
    }
    setSaving(true);
    let ok = true;
    if (gr || gl) {
      ok = (await post({ kind: 'glasses', source: 'manual', right: gr, left: gl, replaceAt: gEditAt })) && ok;
    }
    if (cr || cl) {
      ok = (await post({ kind: 'contact', source: cSource, right: cr, left: cl, replaceAt: cEditAt })) && ok;
    }
    setSaving(false);
    if (!ok) {
      setErr('저장에 실패했습니다.');
      return;
    }
    resetForm();
    load();
    flash(setMsg, '도수를 저장했습니다.');
  }

  function resetForm() {
    setGRight(EMPTY_EYE);
    setGLeft(EMPTY_EYE);
    setGEditAt(null);
    setCRight(EMPTY_EYE);
    setCLeft(EMPTY_EYE);
    setCEditAt(null);
    setCSource('manual');
  }

  function handleEdit(g: PrescriptionGroup) {
    setErr(null);
    if (g.kind === 'glasses') {
      setGRight(eyeDataToForm(g.right));
      setGLeft(eyeDataToForm(g.left));
      setGEditAt(g.recordedAt);
    } else {
      setCRight(eyeDataToForm(g.right));
      setCLeft(eyeDataToForm(g.left));
      setCEditAt(g.recordedAt);
      setCSource((g.source as Source) ?? 'manual');
    }
    flash(setMsg, '기록을 불러왔습니다. 수정 후 저장하세요.');
  }

  const editing = Boolean(gEditAt || cEditAt);
  const glassesHistory = groups.filter((g) => g.kind === 'glasses');
  const contactHistory = groups.filter((g) => g.kind === 'contact');

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="mb-1 text-sm font-bold text-gray-900">시력 (도수) 관리</h2>
      <p className="mb-4 text-[11px] leading-relaxed text-gray-400">
        숫자만 입력하면 0.25D 단위로 자동 변환됩니다 (300 → −3.00 · +100 → +1.00 · 075 → −0.75). ADD 는 +0.25 ~ +4.00.
      </p>

      {canEdit && (
        <div className="space-y-4">
          <PowerSection
            title="안경 도수"
            editing={Boolean(gEditAt)}
            right={gRight}
            left={gLeft}
            onRight={setGRight}
            onLeft={setGLeft}
          />

          {/* 변환 (콘택트 칸 채우기) */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-gray-400">안경 → 콘택트</span>
            <button
              type="button"
              onClick={() => convert('toric')}
              disabled={saving}
              className="rounded-lg border border-brand-300 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-50"
            >
              콘택트도수 변환 (난시)
            </button>
            <button
              type="button"
              onClick={() => convert('se')}
              disabled={saving}
              className="rounded-lg border border-brand-300 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-50"
            >
              구면도수로만 적용
            </button>
          </div>

          <PowerSection
            title="콘택트 도수"
            editing={Boolean(cEditAt)}
            right={cRight}
            left={cLeft}
            onRight={setCRight}
            onLeft={setCLeft}
          />

          <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-gray-900 px-5 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
            >
              {saving ? '저장 중...' : editing ? '수정 저장' : '저장 (안경·콘택트)'}
            </button>
            {editing && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                취소
              </button>
            )}
            {err && <span className="text-sm text-red-600">{err}</span>}
            {msg && <span className="text-sm text-emerald-600">{msg}</span>}
          </div>
        </div>
      )}

      {/* 이력 */}
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <HistoryList
          title="안경 이력"
          items={glassesHistory}
          loading={loading}
          canEdit={canEdit}
          onEdit={handleEdit}
        />
        <HistoryList
          title="콘택트 이력"
          items={contactHistory}
          loading={loading}
          canEdit={canEdit}
          onEdit={handleEdit}
          onRecommend={
            recommendEndpoint ? (g) => setRecommendDose(groupToDose(g)) : undefined
          }
        />
      </div>

      {recommendEndpoint && recommendDose && (
        <RecommendModal
          open={Boolean(recommendDose)}
          onClose={() => setRecommendDose(null)}
          endpoint={recommendEndpoint}
          dose={recommendDose}
        />
      )}
    </div>
  );
}

function PowerSection({
  title,
  editing,
  right,
  left,
  onRight,
  onLeft,
}: {
  title: string;
  editing: boolean;
  right: EyeForm;
  left: EyeForm;
  onRight: (v: EyeForm) => void;
  onLeft: (v: EyeForm) => void;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-800">{title}</span>
        {editing && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
            수정 중
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-gray-400">
              <th className="w-12 py-1 text-left" />
              <th className="py-1 text-left font-semibold">SPH</th>
              <th className="py-1 text-left font-semibold">CYL</th>
              <th className="py-1 text-left font-semibold">AXIS</th>
              <th className="py-1 text-left font-semibold">ADD</th>
            </tr>
          </thead>
          <tbody>
            <EyeInputRow label="우(R)" value={right} onChange={onRight} />
            <EyeInputRow label="좌(L)" value={left} onChange={onLeft} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HistoryList({
  title,
  items,
  loading,
  canEdit,
  onEdit,
  onRecommend,
}: {
  title: string;
  items: PrescriptionGroup[];
  loading: boolean;
  canEdit: boolean;
  onEdit: (g: PrescriptionGroup) => void;
  onRecommend?: (g: PrescriptionGroup) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
        {title} ({items.length})
      </p>
      {loading ? (
        <p className="text-sm text-gray-400">불러오는 중...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400">기록이 없습니다.</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {items.map((g) => (
            <li key={`${g.kind}-${g.recordedAt}`} className="py-2.5 text-xs">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium text-gray-500">
                  {new Date(g.recordedAt).toLocaleDateString('ko-KR')}{' '}
                  {new Date(g.recordedAt).toLocaleTimeString('ko-KR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {(g.source === 'converted' || g.source === 'se') && (
                    <span className="ml-1.5 rounded bg-brand-50 px-1 py-0.5 text-[10px] text-brand-600">
                      {g.source === 'se' ? '구면등가' : '변환'}
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-1">
                  {onRecommend && (
                    <button
                      type="button"
                      onClick={() => onRecommend(g)}
                      className="rounded border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700 hover:bg-brand-100"
                    >
                      추천렌즈
                    </button>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit(g)}
                      className="rounded border border-gray-200 px-2 py-0.5 text-[11px] text-gray-500 hover:bg-gray-50 hover:text-brand-600"
                    >
                      수정
                    </button>
                  )}
                </div>
              </div>
              <EyeReadout label="우 (R)" eye={g.right} />
              <EyeReadout label="좌 (L)" eye={g.left} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EyeReadout({ label, eye }: { label: string; eye: EyeData | null }) {
  if (!eye) return null;
  return (
    <p className="text-gray-700">
      <span className="mr-2 inline-block w-12 text-gray-400">{label}</span>
      SPH {formatDiopter(eye.sphere ? Number(eye.sphere) : null)}
      {eye.cylinder ? ` · CYL ${formatDiopter(Number(eye.cylinder))}` : ''}
      {eye.axis !== null ? ` · AXIS ${eye.axis}` : ''}
      {eye.addPower ? ` · ADD ${formatDiopter(Number(eye.addPower))}` : ''}
    </p>
  );
}

function EyeInputRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: EyeForm;
  onChange: (v: EyeForm) => void;
}) {
  const cls =
    'w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none';
  const set = (patch: Partial<EyeForm>) => onChange({ ...value, ...patch });
  return (
    <tr>
      <td className="py-1 pr-2 text-xs font-medium text-gray-600">{label}</td>
      <td className="py-1 pr-1.5">
        <input
          type="text"
          value={value.sphere}
          onChange={(e) => set({ sphere: e.target.value })}
          onBlur={(e) => set({ sphere: normalizeSignedDiopter(e.target.value) })}
          className={cls}
        />
      </td>
      <td className="py-1 pr-1.5">
        <input
          type="text"
          value={value.cylinder}
          onChange={(e) => set({ cylinder: e.target.value })}
          onBlur={(e) => set({ cylinder: normalizeSignedDiopter(e.target.value) })}
          className={cls}
        />
      </td>
      <td className="py-1 pr-1.5">
        <input
          type="text"
          inputMode="numeric"
          value={value.axis}
          onChange={(e) => set({ axis: e.target.value })}
          onBlur={(e) => set({ axis: normalizeAxis(e.target.value) })}
          className={cls}
        />
      </td>
      <td className="py-1">
        <input
          type="text"
          value={value.addPower}
          onChange={(e) => set({ addPower: e.target.value })}
          onBlur={(e) => set({ addPower: normalizeAddDiopter(e.target.value) })}
          className={cls}
        />
      </td>
    </tr>
  );
}
