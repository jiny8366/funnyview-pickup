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

const KIND_LABEL: Record<Kind, string> = { glasses: '안경', contact: '콘택트' };

/**
 * 고객 시력(도수) 관리 — admin/customer/store 공용.
 * endpoint 는 GET(이력)/POST(저장)를 처리하는 동일 URL.
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
  const [kind, setKind] = useState<Kind>('glasses');
  const [right, setRight] = useState<EyeForm>(EMPTY_EYE);
  const [left, setLeft] = useState<EyeForm>(EMPTY_EYE);
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

  function handleConvert() {
    setErr(null);
    const conv = (f: EyeForm): EyeForm => {
      if (!f.sphere.trim()) return EMPTY_EYE;
      const r = glassesToContactEye({
        sphere: Number(f.sphere),
        cylinder: f.cylinder.trim() ? Number(f.cylinder) : null,
        axis: f.axis.trim() ? Number(f.axis) : null,
        addPower: f.addPower.trim() ? Number(f.addPower) : null,
      });
      return {
        sphere: signedDiopterString(r.sphere),
        cylinder: r.cylinder !== null ? signedDiopterString(r.cylinder) : '',
        axis: r.axis !== null ? String(r.axis) : '',
        addPower: r.addPower !== null ? '+' + Math.abs(r.addPower).toFixed(2) : '',
      };
    };
    if (!right.sphere.trim() && !left.sphere.trim()) {
      setErr('변환할 안경 도수를 먼저 입력하세요.');
      return;
    }
    setRight(conv(right));
    setLeft(conv(left));
    setKind('contact');
    setMsg('안경 도수를 콘택트 도수로 변환했습니다. 확인 후 저장하세요.');
    setTimeout(() => setMsg(null), 4000);
  }

  async function handleSave() {
    setErr(null);
    setMsg(null);
    const l = eyePayload(left);
    const r = eyePayload(right);
    if (!l && !r) {
      setErr('좌/우 중 하나 이상 SPH 를 입력하세요.');
      return;
    }
    setSaving(true);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind, source: 'manual', left: l, right: r }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? '저장에 실패했습니다.');
      return;
    }
    setMsg('저장되었습니다.');
    setRight(EMPTY_EYE);
    setLeft(EMPTY_EYE);
    load();
    setTimeout(() => setMsg(null), 2500);
  }

  const history = groups.filter((g) => g.kind === kind);
  const latest = history[0] ?? null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-900">시력 (도수) 관리</h2>
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {(['glasses', 'contact'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                kind === k ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </div>

      {latest && (
        <div className="mb-4 rounded-xl bg-gray-50 p-3 text-xs">
          <p className="mb-1.5 font-semibold text-gray-500">
            최신 {KIND_LABEL[kind]} 도수 · {new Date(latest.recordedAt).toLocaleDateString('ko-KR')}
          </p>
          <EyeReadout label="우 (R)" eye={latest.right} />
          <EyeReadout label="좌 (L)" eye={latest.left} />
        </div>
      )}

      {canEdit && (
        <>
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
                <EyeInputRow label="우(R)" value={right} onChange={setRight} />
                <EyeInputRow label="좌(L)" value={left} onChange={setLeft} />
              </tbody>
            </table>
          </div>

          <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
            숫자만 입력하면 0.25D 단위로 자동 변환됩니다 (300 → −3.00 · +100 → +1.00 · 075 → −0.75).
            ADD 는 +0.25 ~ +4.00 (150 → +1.50).
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {kind === 'glasses' && (
              <button
                type="button"
                onClick={handleConvert}
                className="rounded-xl border border-brand-300 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100"
              >
                콘택트 도수로 변환 →
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
            >
              {saving ? '저장 중...' : `${KIND_LABEL[kind]} 도수 저장`}
            </button>
          </div>

          {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
          {msg && <p className="mt-2 text-sm text-emerald-600">{msg}</p>}
        </>
      )}

      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
          {KIND_LABEL[kind]} 이력 ({history.length})
        </p>
        {loading ? (
          <p className="text-sm text-gray-400">불러오는 중...</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-400">기록이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {history.map((g) => (
              <li key={`${g.kind}-${g.recordedAt}`} className="py-2.5 text-xs">
                <p className="mb-1 font-medium text-gray-500">
                  {new Date(g.recordedAt).toLocaleDateString('ko-KR')}{' '}
                  {new Date(g.recordedAt).toLocaleTimeString('ko-KR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <EyeReadout label="우 (R)" eye={g.right} />
                <EyeReadout label="좌 (L)" eye={g.left} />
              </li>
            ))}
          </ul>
        )}
      </div>
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
