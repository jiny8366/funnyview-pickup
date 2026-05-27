'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  formatDiopter,
  glassesToContactEye,
  normalizeAddDiopter,
  normalizeAxis,
  normalizeSignedDiopter,
  signedDiopterString,
} from '@/lib/prescription/convert';

type Kind = 'glasses' | 'contact';

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

/**
 * 고객 시력(도수) 관리 — admin/customer/store 공용.
 * 안경·콘택트 입력을 함께 표시. 안경 입력 후 변환하면 콘택트 도수가 자동 계산되어 함께 저장된다.
 * 이력 항목을 클릭하면 해당 기록을 수정할 수 있다.
 */
export function PrescriptionManager({
  endpoint,
  canEdit,
}: {
  endpoint: string;
  canEdit: boolean;
}) {
  const [groups, setGroups] = useState<PrescriptionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [gRight, setGRight] = useState<EyeForm>(EMPTY_EYE);
  const [gLeft, setGLeft] = useState<EyeForm>(EMPTY_EYE);
  const [gEditAt, setGEditAt] = useState<string | null>(null);
  const [cRight, setCRight] = useState<EyeForm>(EMPTY_EYE);
  const [cLeft, setCLeft] = useState<EyeForm>(EMPTY_EYE);
  const [cEditAt, setCEditAt] = useState<string | null>(null);
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
    const axis = normalizeAxis(f.axis);
    return {
      sphere,
      cylinder: normalizeSignedDiopter(f.cylinder) || null,
      axis: axis ? Number(axis) : null,
      addPower: normalizeAddDiopter(f.addPower) || null,
    };
  }

  function flash(setter: (v: string | null) => void, text: string) {
    setter(text);
    setTimeout(() => setter(null), 2800);
  }

  async function post(body: Record<string, unknown>): Promise<boolean> {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  }

  function contactFormFromGlasses(p: NonNullable<ReturnType<typeof eyePayload>>): EyeForm {
    const r = glassesToContactEye({
      sphere: Number(p.sphere),
      cylinder: p.cylinder ? Number(p.cylinder) : null,
      axis: p.axis,
      addPower: p.addPower ? Number(p.addPower) : null,
    });
    return {
      sphere: signedDiopterString(r.sphere),
      cylinder: r.cylinder !== null ? signedDiopterString(r.cylinder) : '',
      axis: r.axis !== null ? String(r.axis) : '',
      addPower: r.addPower !== null ? '+' + Math.abs(r.addPower).toFixed(2) : '',
    };
  }

  // 안경 도수만 저장
  async function handleSaveGlasses() {
    setErr(null);
    const r = eyePayload(gRight);
    const l = eyePayload(gLeft);
    if (!r && !l) {
      setErr('안경 도수를 입력하세요 (좌/우 중 하나 이상).');
      return;
    }
    setSaving(true);
    const ok = await post({ kind: 'glasses', source: 'manual', right: r, left: l, replaceAt: gEditAt });
    setSaving(false);
    if (!ok) {
      setErr('안경 도수 저장에 실패했습니다.');
      return;
    }
    setGRight(EMPTY_EYE);
    setGLeft(EMPTY_EYE);
    setGEditAt(null);
    load();
    flash(setMsg, '안경 도수를 저장했습니다.');
  }

  // 안경 → 콘택트 변환 후 둘 다 저장
  async function handleConvert() {
    setErr(null);
    const r = eyePayload(gRight);
    const l = eyePayload(gLeft);
    if (!r && !l) {
      setErr('변환할 안경 도수를 먼저 입력하세요.');
      return;
    }
    const cr = r ? contactFormFromGlasses(r) : EMPTY_EYE;
    const cl = l ? contactFormFromGlasses(l) : EMPTY_EYE;
    setCRight(cr);
    setCLeft(cl);
    setSaving(true);
    const ok1 = await post({ kind: 'glasses', source: 'manual', right: r, left: l, replaceAt: gEditAt });
    const ok2 = await post({
      kind: 'contact',
      source: 'converted',
      right: eyePayload(cr),
      left: eyePayload(cl),
    });
    setSaving(false);
    if (!ok1 || !ok2) {
      setErr('변환·저장에 실패했습니다.');
      return;
    }
    setGRight(EMPTY_EYE);
    setGLeft(EMPTY_EYE);
    setGEditAt(null);
    load();
    flash(setMsg, '안경 도수를 콘택트로 변환해 함께 저장했습니다.');
  }

  // 콘택트 도수 저장 (직접 입력 또는 수정)
  async function handleSaveContact() {
    setErr(null);
    const r = eyePayload(cRight);
    const l = eyePayload(cLeft);
    if (!r && !l) {
      setErr('콘택트 도수를 입력하세요 (좌/우 중 하나 이상).');
      return;
    }
    setSaving(true);
    const ok = await post({ kind: 'contact', source: 'manual', right: r, left: l, replaceAt: cEditAt });
    setSaving(false);
    if (!ok) {
      setErr('콘택트 도수 저장에 실패했습니다.');
      return;
    }
    setCRight(EMPTY_EYE);
    setCLeft(EMPTY_EYE);
    setCEditAt(null);
    load();
    flash(setMsg, '콘택트 도수를 저장했습니다.');
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
    }
    flash(setMsg, '기록을 불러왔습니다. 수정 후 저장하세요.');
  }

  function cancelGlasses() {
    setGRight(EMPTY_EYE);
    setGLeft(EMPTY_EYE);
    setGEditAt(null);
  }
  function cancelContact() {
    setCRight(EMPTY_EYE);
    setCLeft(EMPTY_EYE);
    setCEditAt(null);
  }

  const glassesHistory = groups.filter((g) => g.kind === 'glasses');
  const contactHistory = groups.filter((g) => g.kind === 'contact');

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="mb-1 text-sm font-bold text-gray-900">시력 (도수) 관리</h2>
      <p className="mb-4 text-[11px] leading-relaxed text-gray-400">
        숫자만 입력하면 0.25D 단위로 자동 변환됩니다 (300 → −3.00 · +100 → +1.00 · 075 → −0.75). ADD 는 +0.25 ~ +4.00.
      </p>

      {canEdit && (
        <div className="space-y-5">
          {/* 안경 도수 */}
          <PowerSection
            title="안경 도수"
            editing={Boolean(gEditAt)}
            right={gRight}
            left={gLeft}
            onRight={setGRight}
            onLeft={setGLeft}
          >
            <button
              type="button"
              onClick={handleConvert}
              disabled={saving}
              className="rounded-xl border border-brand-300 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-50"
            >
              콘택트로 변환 후 저장 →
            </button>
            <button
              type="button"
              onClick={handleSaveGlasses}
              disabled={saving}
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
            >
              {gEditAt ? '안경 수정 저장' : '안경만 저장'}
            </button>
            {gEditAt && (
              <button
                type="button"
                onClick={cancelGlasses}
                className="rounded-xl px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                취소
              </button>
            )}
          </PowerSection>

          {/* 콘택트 도수 */}
          <PowerSection
            title="콘택트 도수"
            editing={Boolean(cEditAt)}
            right={cRight}
            left={cLeft}
            onRight={setCRight}
            onLeft={setCLeft}
          >
            <button
              type="button"
              onClick={handleSaveContact}
              disabled={saving}
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
            >
              {cEditAt ? '콘택트 수정 저장' : '콘택트 저장'}
            </button>
            {cEditAt && (
              <button
                type="button"
                onClick={cancelContact}
                className="rounded-xl px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                취소
              </button>
            )}
          </PowerSection>

          {err && <p className="text-sm text-red-600">{err}</p>}
          {msg && <p className="text-sm text-emerald-600">{msg}</p>}
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
        />
      </div>
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
  children,
}: {
  title: string;
  editing: boolean;
  right: EyeForm;
  left: EyeForm;
  onRight: (v: EyeForm) => void;
  onLeft: (v: EyeForm) => void;
  children: React.ReactNode;
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
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function HistoryList({
  title,
  items,
  loading,
  canEdit,
  onEdit,
}: {
  title: string;
  items: PrescriptionGroup[];
  loading: boolean;
  canEdit: boolean;
  onEdit: (g: PrescriptionGroup) => void;
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
                  {g.source === 'converted' && (
                    <span className="ml-1.5 rounded bg-brand-50 px-1 py-0.5 text-[10px] text-brand-600">
                      변환
                    </span>
                  )}
                </span>
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
          placeholder="300"
          className={cls}
        />
      </td>
      <td className="py-1 pr-1.5">
        <input
          type="text"
          value={value.cylinder}
          onChange={(e) => set({ cylinder: e.target.value })}
          onBlur={(e) => set({ cylinder: normalizeSignedDiopter(e.target.value) })}
          placeholder="075"
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
          placeholder="180"
          className={cls}
        />
      </td>
      <td className="py-1">
        <input
          type="text"
          value={value.addPower}
          onChange={(e) => set({ addPower: e.target.value })}
          onBlur={(e) => set({ addPower: normalizeAddDiopter(e.target.value) })}
          placeholder="150"
          className={cls}
        />
      </td>
    </tr>
  );
}
