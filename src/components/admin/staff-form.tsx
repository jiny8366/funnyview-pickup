'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface StoreOption {
  id: string;
  name: string;
}

interface Props {
  stores: StoreOption[];
}

type StaffRole = 'admin' | 'warehouse_staff' | 'store_staff';

interface FormState {
  role: StaffRole;
  email: string;
  phone: string;
  password: string;
  passwordConfirm: string;
  storeId: string;
  isActive: boolean;
}

const EMPTY: FormState = {
  role: 'admin',
  email: '',
  phone: '',
  password: '',
  passwordConfirm: '',
  storeId: '',
  isActive: true,
};

const ROLE_OPTIONS: Array<{ value: StaffRole; label: string; help: string }> = [
  { value: 'admin', label: '관리자', help: '모든 portal 접근 가능 (디버깅/대행 포함)' },
  { value: 'warehouse_staff', label: '픽업서비스 업체', help: '입고/출고 픽리스트 처리' },
  { value: 'store_staff', label: '픽업가맹점', help: '소속 매장 픽업 수령 처리 — 가맹점 선택 필수' },
];

function errorMessage(code: string): string {
  switch (code) {
    case 'INVALID_INPUT':
      return '입력 값이 올바르지 않습니다';
    case 'PASSWORD_MISMATCH':
      return '비밀번호가 일치하지 않습니다';
    case 'STORE_ID_REQUIRED':
      return '픽업가맹점을 선택해주세요';
    case 'STORE_ID_NOT_ALLOWED':
      return '해당 역할은 픽업가맹점을 선택할 수 없습니다';
    case 'STORE_NOT_FOUND':
      return '선택한 가맹점을 찾을 수 없습니다';
    case 'PHONE_TAKEN':
      return '이미 등록된 휴대전화입니다';
    case 'EMAIL_TAKEN':
      return '이미 등록된 이메일입니다';
    case 'FORBIDDEN':
      return '관리자 권한이 필요합니다';
    default:
      return code;
  }
}

export function StaffForm({ stores }: Props) {
  const router = useRouter();
  const [f, setF] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setF((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (f.password !== f.passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다');
      return;
    }
    if (f.role === 'store_staff' && !f.storeId) {
      setError('픽업가맹점을 선택해주세요');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          role: f.role,
          email: f.email.trim(),
          phone: f.phone.replace(/\D/g, ''),
          password: f.password,
          passwordConfirm: f.passwordConfirm,
          storeId: f.role === 'store_staff' ? f.storeId : null,
          isActive: f.isActive,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(errorMessage(body.error ?? 'UNKNOWN'));
        return;
      }
      router.push('/admin/staff');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록 실패');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto max-w-3xl space-y-6"
    >
      <section className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">역할 선택</h2>
        <div className="space-y-2">
          {ROLE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                f.role === opt.value
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="role"
                value={opt.value}
                checked={f.role === opt.value}
                onChange={() => set('role', opt.value)}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">{opt.label}</div>
                <div className="text-xs text-gray-500">{opt.help}</div>
              </div>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">계정 정보</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="이메일 (로그인 ID 로 사용)" required>
            <input
              type="email"
              autoComplete="off"
              required
              value={f.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="staff@funnyview.kr"
              className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm"
            />
          </Field>
          <Field label="휴대전화" required hint="010-0000-0000 (인증은 추후 PASS/NICE)">
            <input
              type="tel"
              autoComplete="off"
              required
              value={f.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="01012345678"
              className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm"
            />
          </Field>
          <Field label="비밀번호" required hint="8-16자, 영문 대소/숫자/특수 중 3가지 이상">
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={16}
              value={f.password}
              onChange={(e) => set('password', e.target.value)}
              className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm"
            />
          </Field>
          <Field label="비밀번호 확인" required>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={16}
              value={f.passwordConfirm}
              onChange={(e) => set('passwordConfirm', e.target.value)}
              className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm"
            />
          </Field>
        </div>
      </section>

      {f.role === 'store_staff' && (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">소속 픽업가맹점</h2>
          <Field label="가맹점 선택" required>
            <select
              required
              value={f.storeId}
              onChange={(e) => set('storeId', e.target.value)}
              className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm"
            >
              <option value="">— 선택 —</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        </section>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">상태</h2>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={f.isActive}
            onChange={(e) => set('isActive', e.target.checked)}
          />
          활성 (체크 해제 시 로그인 불가)
        </label>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push('/admin/staff')}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
        >
          {submitting ? '등록 중…' : '계정 등록'}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <div className="flex items-baseline gap-1 text-xs font-medium text-gray-700">
        <span>{label}</span>
        {required && <span className="text-red-500">*</span>}
      </div>
      {children}
      {hint && <div className="text-[11px] text-gray-400">{hint}</div>}
    </label>
  );
}
