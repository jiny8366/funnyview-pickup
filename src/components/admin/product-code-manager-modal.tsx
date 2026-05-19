'use client';

import { useEffect, useState } from 'react';

interface ProductCodeRow {
  id: string;
  nameKo: string;
  nameEn: string;
  code: string;
  suffix: string;
  isActive: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** 행 클릭 시 호출 — 부모 폼이 productCode 자동 채움. */
  onSelect?: (pc: ProductCodeRow) => void;
}

function errorMessage(code: string): string {
  switch (code) {
    case 'INVALID_INPUT':
      return '입력 값이 올바르지 않습니다 (영문 약자 3자 + 구분자 2자)';
    case 'NAME_TAKEN':
      return '이미 등록된 국문명입니다';
    case 'CODE_TAKEN':
      return '이미 등록된 코드 조합입니다 (3자+2자)';
    case 'FORBIDDEN':
      return '관리자 권한이 필요합니다';
    default:
      return code;
  }
}

export function ProductCodeManagerModal({ open, onClose, onSelect }: Props) {
  const [rows, setRows] = useState<ProductCodeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [nameKo, setNameKo] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [code, setCode] = useState('');
  const [suffix, setSuffix] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/product-codes', { cache: 'no-store' });
      if (res.ok) {
        const body = await res.json();
        setRows(body.productCodes ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      refresh();
      setNameKo('');
      setNameEn('');
      setCode('');
      setSuffix('');
      setError(null);
    }
  }, [open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/product-codes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nameKo: nameKo.trim(),
          nameEn: nameEn.trim(),
          code: code.trim().toUpperCase(),
          suffix: suffix.trim().toUpperCase(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(errorMessage(body.error ?? 'UNKNOWN'));
        return;
      }
      setNameKo('');
      setNameEn('');
      setCode('');
      setSuffix('');
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">제품 코드 관리</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
            aria-label="닫기"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3 border-b border-gray-100 px-5 py-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-gray-700">
                영문명 <span className="text-red-500">*</span>
              </span>
              <input
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="One and Only 1day"
                required
                className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-gray-700">
                국문명 <span className="text-red-500">*</span>
              </span>
              <input
                value={nameKo}
                onChange={(e) => setNameKo(e.target.value)}
                placeholder="원앤온리 원데이"
                required
                className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-gray-700">
                영문 약자 (3자) <span className="text-red-500">*</span>
              </span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="OOL"
                required
                maxLength={3}
                pattern="[A-Z0-9]{3}"
                className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm font-mono uppercase"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-gray-700">
                구분자 (2자) <span className="text-red-500">*</span>
              </span>
              <input
                value={suffix}
                onChange={(e) => setSuffix(e.target.value.toUpperCase())}
                placeholder="1D"
                required
                maxLength={2}
                pattern="[A-Z0-9]{2}"
                className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm font-mono uppercase"
              />
            </label>
          </div>

          {code && suffix && code.length === 3 && suffix.length === 2 && (
            <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
              조합 미리보기: <span className="font-mono font-semibold text-gray-900">{code}{suffix}</span> (5자)
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
            >
              {submitting ? '등록 중…' : '제품 코드 등록'}
            </button>
          </div>
        </form>

        <div className="max-h-[50vh] overflow-y-auto px-5 py-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            등록된 제품 코드 ({rows.length}) — 영문 순
          </h3>
          {loading ? (
            <div className="text-center text-sm text-gray-400">불러오는 중…</div>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 py-6 text-center text-xs text-gray-400">
              아직 등록된 제품 코드가 없습니다
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    영문명
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    국문명
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    코드
                  </th>
                  {onSelect && (
                    <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                      선택
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((pc) => (
                  <tr key={pc.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-700">{pc.nameEn}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">{pc.nameKo}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">
                      {pc.code}
                      {pc.suffix}
                    </td>
                    {onSelect && (
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            onSelect(pc);
                            onClose();
                          }}
                          className="rounded border border-brand-300 bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700 hover:bg-brand-100"
                        >
                          선택
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
