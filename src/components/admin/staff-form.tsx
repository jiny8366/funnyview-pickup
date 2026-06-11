'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ALL_PERMISSIONS,
  PERMISSION_GROUPS,
  ROLE_DEFAULTS,
} from '@/lib/auth/permissions';

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
  /** users.permissions raw 값. NULL 이면 role 기본값. */
  permissions: string[] | null;
  /** 마스터 사용자 (MASTER_USERNAMES env). role/permissions/isActive 변경 차단. */
  isMaster: boolean;
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
  /** 사용자 지정 권한 활성화 여부. false 면 role 기본값(NULL) 저장. */
  useCustomPerms: boolean;
  /** 사용자 지정 권한 set (useCustomPerms=true 일 때만 의미). */
  perms: Set<string>;
}

const ROLE_OPTIONS: Array<{ value: StaffRole; label: string; help: string }> = [
  { value: 'admin', label: '퍼니뷰 관리자', help: '모든 portal 접근 가능 (디버깅/대행 포함)' },
  { value: 'warehouse_staff', label: '픽업관리', help: '입고/출고 픽리스트 처리' },
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
    case 'CANNOT_MODIFY_MASTER':
      return '마스터 계정은 수정/삭제할 수 없습니다 (MASTER_USERNAMES 환경변수로만 관리)';
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
  const isMasterTarget = isEdit && Boolean(initial?.isMaster);
  // 마스터 대상은 role/storeId/isActive/permissions 잠금 — 비밀번호/email/phone 만 변경 가능
  const lockMutation = isMasterTarget || isSelf;

  const [f, setF] = useState<FormState>(() => {
    if (initial) {
      const useCustom = Array.isArray(initial.permissions) && initial.permissions.length > 0;
      return {
        role: initial.role,
        email: initial.email,
        phone: initial.phone,
        password: '',
        passwordConfirm: '',
        storeId: initial.storeId ?? '',
        isActive: initial.isActive,
        useCustomPerms: useCustom,
        perms: new Set(useCustom ? initial.permissions ?? [] : ROLE_DEFAULTS[initial.role] ?? []),
      };
    }
    return {
      role: 'admin',
      email: '',
      phone: '',
      password: '',
      passwordConfirm: '',
      storeId: '',
      isActive: true,
      useCustomPerms: false,
      perms: new Set(ROLE_DEFAULTS.admin ?? []),
    };
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setF((prev) => ({ ...prev, [key]: value }));
  }

  // role 변경 시 사용자 지정 권한 OFF 상태면 ROLE_DEFAULTS 자동 반영
  useEffect(() => {
    if (!f.useCustomPerms) {
      setF((prev) => ({ ...prev, perms: new Set(ROLE_DEFAULTS[prev.role] ?? []) }));
    }
  }, [f.role, f.useCustomPerms]);

  function togglePerm(key: string) {
    setF((prev) => {
      const next = new Set(prev.perms);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...prev, perms: next };
    });
  }

  const permsByGroup = useMemo(() => {
    return PERMISSION_GROUPS.map((g) => ({
      group: g,
      items: ALL_PERMISSIONS.filter((p) => p.group === g),
    }));
  }, []);

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
      // 마스터 사용자는 permissions 변경 차단 (서버도 가드, 클라이언트도 안 보냄)
      if (!isMasterTarget) {
        // useCustomPerms=false → null 저장 (ROLE_DEFAULTS 따름)
        // useCustomPerms=true  → 배열 저장 (override)
        body.permissions = f.useCustomPerms ? Array.from(f.perms) : null;
      }
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
              } ${lockMutation ? 'opacity-60' : ''}`}
            >
              <input
                type="radio"
                name="role"
                value={opt.value}
                checked={f.role === opt.value}
                onChange={() => set('role', opt.value)}
                disabled={lockMutation}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">{opt.label}</div>
                <div className="text-xs text-gray-500">{opt.help}</div>
              </div>
            </label>
          ))}
        </div>
        {isMasterTarget && (
          <p className="mt-2 text-[11px] text-red-600">
            🛡 마스터 계정 (MASTER_USERNAMES) — 역할 변경 불가
          </p>
        )}
        {!isMasterTarget && isSelf && (
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
              disabled={lockMutation}
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
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-700">권한 설정</h2>
          {!isMasterTarget && (
            <label className="inline-flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={f.useCustomPerms}
                onChange={(e) => set('useCustomPerms', e.target.checked)}
              />
              사용자 지정 권한 활성화
            </label>
          )}
        </div>
        {isMasterTarget ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
            🛡 <strong>마스터 계정</strong> — MASTER_USERNAMES 환경변수에 등록된 최상위 권한.
            현재 및 향후 추가될 모든 권한을 자동으로 가지며, 권한 변경이 불가합니다.
          </div>
        ) : (
          <>
            <p className="mb-4 text-[11px] text-gray-500">
              {f.useCustomPerms
                ? '아래 체크박스로 선택한 권한만 부여됩니다.'
                : `해제 시 역할의 기본 권한(${
                    ROLE_DEFAULTS[f.role]?.length ?? 0
                  }개)을 따릅니다. 관리자는 전권을 갖습니다.`}
            </p>

            <div className={`grid gap-4 ${f.useCustomPerms ? '' : 'opacity-50'}`}>
              {permsByGroup.map(({ group, items }) => (
                <div key={group} className="rounded-xl border border-gray-100 p-3">
                  <div className="mb-2 text-xs font-semibold text-gray-600">{group}</div>
                  <div className="grid gap-1.5 md:grid-cols-2">
                    {items.map((p) => (
                      <label
                        key={p.key}
                        className={`flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-xs ${
                          f.useCustomPerms ? 'hover:bg-gray-50' : 'cursor-not-allowed'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={f.perms.has(p.key)}
                          onChange={() => togglePerm(p.key)}
                          disabled={!f.useCustomPerms}
                          className="mt-0.5"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-800">{p.label}</div>
                          <div className="font-mono text-[10px] text-gray-400">{p.key}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">상태</h2>
        <label
          className={`flex items-center gap-2 text-sm text-gray-700 ${lockMutation ? 'opacity-60' : ''}`}
        >
          <input
            type="checkbox"
            checked={f.isActive}
            onChange={(e) => set('isActive', e.target.checked)}
            disabled={lockMutation}
          />
          활성 (체크 해제 시 로그인 불가)
        </label>
        {isMasterTarget && (
          <p className="mt-1.5 text-[11px] text-red-600">
            🛡 마스터 계정 — 비활성화 불가
          </p>
        )}
        {!isMasterTarget && isSelf && (
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
