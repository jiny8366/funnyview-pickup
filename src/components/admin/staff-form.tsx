'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface StoreOption {
  id: string;
  name: string;
}

type StaffRole = 'admin' | 'warehouse_staff' | 'store_staff';

interface StaffInitial {
  id: string;
  role: StaffRole;
  email: string;
  phone: string;
  storeId: string | null;
  isActive: boolean;
}

interface Props {
  stores: StoreOption[];
  mode: 'create' | 'edit';
  initial?: StaffInitial;
  /** 현재 로그인된 관리자의 user id — 본인 보호 가드용 */
  currentUserId?: string;
}

interface FormState {
  role: StaffRole;
  email: string;
  phone: string;
  password: string;
  passwordConfirm: string;
  storeId: string;
  isActive: boolean;
}

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
    case 'CANNOT_MODIFY_SELF_ROLE':
      return '본인의 역할은 변경할 수 없습니다';
    case 'CANNOT_DEACTIVATE_SELF':
      return '본인 계정은 비활성화할 수 없습니다';
    case 'NOT_FOUND':
      return '계정을 찾을 수 없습니다';
    default:
      return code;
  }
}

export function StaffForm({ stores, mode, initial, currentUserId }: Props) {
  const router = useRouter();
  const isEdit = mode === 'edit';
  const isSelf = isEdit && initial?.id === currentUserId;

  const [f, setF] = useState<FormState>(() =>
    initial
      ? {
          role: initial.role,
          email: initial.email,
          phone: initial.phone,
          password: '',
          passwordConfirm: '',
          storeId: initial.storeId ?? '',
          isActive: initial.isActive,
        }
      : {
          role: 'admin',
          email: '',
          phone: '',
          password: '',
          passwordConfirm: '',
          storeId: '',
          isActive: true,
        },
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setF((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (f.password && f.password !== f.passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다');
      return;
    }
    if (f.role === 'store_staff' && !f.storeId) {
      setError('픽업가맹점을 선택해주세요');
      return;
    }

    setSubmitting(true);
    try {
      const url = isEdit ? `/api/admin/staff/${initial!.id}` : '/api/admin/staff';
      const method = isEdit ? 'PATCH' : 'POST';

      const body: Record<string, unknown> = {
        role: f.role,
        email: f.email.trim(),
        phone: f.phone.replace(/\D/g, ''),
        storeId: f.role === 'store_staff' ? f.storeId : null,
        isActive: f.isActive,
      };
      // 생성 모드는 비밀번호 필수, 편집 모드는 입력했을 때만 변경
      if (!isEdit) {
        body.password = f.password;
        body.passwordConfirm = f.passwordConfirm;
      } else if (f.password) {
        body.password = f.password;
        body.passwordConfirm = f.passwordConfirm;
      }

      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const resBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(errorMessage(resBody.error ?? 'UNKNOWN'));
        return;
      }
      router.push('/admin/staff');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-3xl space-y-6">
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
              } ${isSelf ? 'opacity-60' : ''}`}
            >
              <input
                type="radio"
                name="role"
                value={opt.value}
                checked={f.role === opt.value}
                onChange={() => set('role', opt.value)}
                disabled={isSelf}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">{opt.label}</div>
                <div className="text-xs text-gray-500">{opt.help}</div>
              </div>
            </label>
          ))}
        </div>
        {isSelf && (
          <p className="mt-2 text-[11px] text-amber-600">
            본인 계정의 역할은 안전상 변경할 수 없습니다.
          </p>
        )}
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
          <Field
            label={isEdit ? '새 비밀번호 (변경 시에만 입력)' : '비밀번호'}
            required={!isEdit}
            hint="8-16자, 영문 대소/숫자/특수 중 3가지 이상"
          >
            <input
              type="password"
              autoComplete="new-password"
              required={!isEdit}
              minLength={8}
              maxLength={16}
              value={f.password}
              onChange={(e) => set('password', e.target.value)}
              className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm"
            />
          </Field>
          <Field label="비밀번호 확인" required={!isEdit && Boolean(f.password)}>
            <input
              type="password"
              autoComplete="new-password"
              required={!isEdit && Boolean(f.password)}
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
              disabled={isSelf}
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
        <label
          className={`flex items-center gap-2 text-sm text-gray-700 ${isSelf ? 'opacity-60' : ''}`}
        >
          <input
            type="checkbox"
            checked={f.isActive}
            onChange={(e) => set('isActive', e.target.checked)}
            disabled={isSelf}
          />
          활성 (체크 해제 시 로그인 불가)
        </label>
        {isSelf && (
          <p className="mt-1.5 text-[11px] text-amber-600">
            본인 계정은 비활성화할 수 없습니다.
          </p>
        )}
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
          {submitting ? '저장 중…' : isEdit ? '변경 사항 저장' : '계정 등록'}
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
