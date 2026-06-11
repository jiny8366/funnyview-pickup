'use client';

import { useEffect, useState } from 'react';

interface BrandRow {
  id: string;
  nameKo: string;
  nameEn: string;
  code: string;
  isActive: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** 새 브랜드가 추가되면 호출 — 부모 폼이 select 옵션 새로고침 + 그 브랜드 자동 선택. */
  onCreated?: (brand: BrandRow) => void;
}

function errorMessage(code: string): string {
  switch (code) {
    case 'INVALID_INPUT':
      return '입력 값이 올바르지 않습니다 (영문 약자는 대문자 3자)';
    case 'NAME_TAKEN':
      return '이미 등록된 국문명입니다';
    case 'CODE_TAKEN':
      return '이미 등록된 영문 약자입니다';
    case 'FORBIDDEN':
      return '관리자 권한이 필요합니다';
    default:
      return code;
  }
}

export function BrandManagerModal({ open, onClose, onCreated }: Props) {
  const [rows, setRows] = useState<BrandRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [nameKo, setNameKo] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/brands', { cache: 'no-store' });
      if (res.ok) {
        const body = await res.json();
        setRows(body.brands ?? []);
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
      setError(null);
    }
  }, [open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/brands', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nameKo: nameKo.trim(),
          nameEn: nameEn.trim(),
          code: code.trim().toUpperCase(),
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
      await refresh();
      if (body.brand && onCreated) {
        onCreated(body.brand);
      }
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
      <div className="w-full max-w-2xl animate-scale-in overflow-hidden rounded-2xl bg-white shadow-pop">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">브랜드 관리</h2>
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
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-gray-700">
                영문명 <span className="text-red-500">*</span>
              </span>
              <input
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="ACUVUE"
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
                placeholder="아큐브"
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
                placeholder="ACU"
                required
                maxLength={3}
                pattern="[A-Z]{3}"
                className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm font-mono uppercase"
              />
            </label>
          </div>

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
              {submitting ? '등록 중…' : '브랜드 등록'}
            </button>
          </div>
        </form>

        <div className="max-h-[50vh] overflow-y-auto px-5 py-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            등록된 브랜드 ({rows.length})
          </h3>
          {loading ? (
            <div className="text-center text-sm text-gray-400">불러오는 중…</div>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 py-6 text-center text-xs text-gray-400">
              아직 등록된 브랜드가 없습니다
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
                    약자
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((b) => (
                  <tr key={b.id}>
                    <td className="px-3 py-2 text-gray-700">{b.nameEn}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">{b.nameKo}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">{b.code}</td>
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
