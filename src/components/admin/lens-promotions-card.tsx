'use client';

import { useEffect, useState } from 'react';

interface PromoRow {
  id: string;
  kind: 'sale' | 'promotion' | 'volume_bundle';
  discountAmount: number | null;
  discountPercent: number | null;
  storeTier: string | null;
  buyQty: number | null;
  freeQty: number | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  note: string | null;
}

interface Props {
  lensId: string;
}

const KIND_LABEL: Record<PromoRow['kind'], string> = {
  sale: '할인판매가',
  promotion: '프로모션가',
  volume_bundle: '물량할증 (1+1, 2+1)',
};

export function LensPromotionsCard({ lensId }: Props) {
  const [rows, setRows] = useState<PromoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<PromoRow['kind']>('sale');
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [storeTier, setStoreTier] = useState('');
  const [buyQty, setBuyQty] = useState('');
  const [freeQty, setFreeQty] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/lenses/${lensId}/promotions`, { cache: 'no-store' });
      if (res.ok) {
        const body = await res.json();
        setRows(body.promotions ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lensId]);

  function reset() {
    setDiscountAmount('');
    setDiscountPercent('');
    setStoreTier('');
    setBuyQty('');
    setFreeQty('');
    setStartsAt('');
    setEndsAt('');
    setNote('');
    setError(null);
  }

  async function add() {
    setError(null);
    const body: Record<string, unknown> = { kind };
    if (kind === 'sale' || kind === 'promotion') {
      body.discountAmount = discountAmount ? Number(discountAmount) : 0;
      body.discountPercent = discountPercent ? Number(discountPercent) : 0;
      if (kind === 'sale' && storeTier) body.storeTier = storeTier;
    } else {
      if (!buyQty || !freeQty) {
        setError('기준 구매 갯수와 무료 갯수를 입력하세요');
        return;
      }
      body.buyQty = Number(buyQty);
      body.freeQty = Number(freeQty);
    }
    body.startsAt = startsAt || null;
    body.endsAt = endsAt || null;
    body.note = note || null;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/lenses/${lensId}/promotions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? '저장 실패');
        return;
      }
      reset();
      refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('이 프로모션을 삭제합니다.')) return;
    const res = await fetch(`/api/admin/promotions/${id}`, { method: 'DELETE' });
    if (res.ok) refresh();
  }

  async function toggleActive(id: string, isActive: boolean) {
    const res = await fetch(`/api/admin/promotions/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    });
    if (res.ok) refresh();
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-gray-800">프로모션</h2>
        <p className="mt-1 text-[11px] text-gray-500">
          할인판매가 (가맹점 등급별/기간) · 프로모션가 (기간 한정) · 1+1·2+1 물량할증 (원가율 자동 반영)
        </p>
      </div>

      {/* 신규 추가 */}
      <div className="border-b border-gray-100 px-5 py-4">
        <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
          {(['sale', 'promotion', 'volume_bundle'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKind(k);
                reset();
              }}
              className={`rounded-lg border px-3 py-1.5 font-medium ${
                kind === k
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {(kind === 'sale' || kind === 'promotion') && (
            <>
              <FormField label="할인 금액 (₩)">
                <input
                  type="number"
                  min={0}
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  className="input"
                />
              </FormField>
              <FormField label="할인 (%)">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                  className="input"
                />
              </FormField>
              {kind === 'sale' && (
                <FormField label="가맹점 등급 (선택)">
                  <input
                    value={storeTier}
                    onChange={(e) => setStoreTier(e.target.value)}
                    placeholder="A / B / gold / silver …"
                    className="input"
                  />
                </FormField>
              )}
            </>
          )}
          {kind === 'volume_bundle' && (
            <>
              <FormField label="기준 구매 갯수 *">
                <input
                  type="number"
                  min={1}
                  value={buyQty}
                  onChange={(e) => setBuyQty(e.target.value)}
                  placeholder="예: 1 (1+1) / 2 (2+1)"
                  className="input"
                />
              </FormField>
              <FormField label="무료 갯수 *">
                <input
                  type="number"
                  min={1}
                  value={freeQty}
                  onChange={(e) => setFreeQty(e.target.value)}
                  placeholder="예: 1"
                  className="input"
                />
              </FormField>
              <div className="md:col-span-1" />
            </>
          )}
          <FormField label="시작일">
            <input
              type="date"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="input"
            />
          </FormField>
          <FormField label="종료일">
            <input
              type="date"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="input"
            />
          </FormField>
          <FormField label="메모">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="input"
            />
          </FormField>
        </div>

        {error && (
          <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={add}
            disabled={submitting}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
          >
            {submitting ? '저장 중…' : '프로모션 추가'}
          </button>
        </div>
      </div>

      {/* 목록 */}
      <div className="px-5 py-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          등록된 프로모션 ({rows.length})
        </h3>
        {loading ? (
          <div className="text-center text-xs text-gray-400">불러오는 중…</div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 py-6 text-center text-xs text-gray-400">
            아직 등록된 프로모션이 없습니다
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div
                key={r.id}
                className={`flex items-center justify-between gap-3 rounded-lg border p-3 text-xs ${
                  r.isActive ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50 opacity-70'
                }`}
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${kindColor(
                        r.kind,
                      )}`}
                    >
                      {KIND_LABEL[r.kind]}
                    </span>
                    {r.storeTier && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                        등급: {r.storeTier}
                      </span>
                    )}
                    {!r.isActive && (
                      <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600">
                        비활성
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-[11px] text-gray-700">
                    {r.kind === 'volume_bundle'
                      ? `${r.buyQty} + ${r.freeQty} (${r.buyQty}개 구매 시 ${r.freeQty}개 무료)`
                      : `${r.discountAmount ? `₩${r.discountAmount.toLocaleString()}` : ''} ${
                          r.discountPercent ? `${r.discountPercent}%` : ''
                        } 할인`.trim()}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {r.startsAt ? new Date(r.startsAt).toLocaleDateString('ko-KR') : '즉시'} ~{' '}
                    {r.endsAt ? new Date(r.endsAt).toLocaleDateString('ko-KR') : '무기한'}
                    {r.note && <span className="ml-2 text-gray-400">· {r.note}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => toggleActive(r.id, r.isActive)}
                    className="rounded border border-gray-200 bg-white px-2 py-1 text-[10px] text-gray-600 hover:bg-gray-50"
                  >
                    {r.isActive ? '비활성화' : '활성화'}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(r.id)}
                    className="rounded border border-red-200 bg-white px-2 py-1 text-[10px] text-red-600 hover:bg-red-50"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function kindColor(kind: string): string {
  switch (kind) {
    case 'sale':
      return 'bg-amber-50 text-amber-700';
    case 'promotion':
      return 'bg-brand-50 text-brand-700';
    case 'volume_bundle':
      return 'bg-emerald-50 text-emerald-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-gray-600">{label}</span>
      {children}
    </label>
  );
}
