'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AddressSearchButton } from '@/components/ui/address-search';

export interface CustomerEditInitial {
  name: string;
  phone: string;
  gender: string | null;
  birthDate: string | null;
  postalCode: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  landlinePhone: string | null;
  memberType: string;
  adminMemo: string | null;
}

/** 한국 전화번호 자동 하이픈 (숫자만 입력 → 표시는 010-1234-5678 / 02-123-4567). */
function formatPhoneKR(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.startsWith('02')) {
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)}-${d.slice(2)}`;
    if (d.length <= 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}`;
  }
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 11)}`;
}

export function CustomerEditForm({
  customerId,
  canWrite,
  initial,
}: {
  customerId: string;
  canWrite: boolean;
  initial: CustomerEditInitial;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: initial.name ?? '',
    phone: formatPhoneKR(initial.phone ?? ''),
    // 기본 여성 — 미설정(null/other) 고객도 여성으로 표시
    gender: initial.gender === 'male' ? 'male' : 'female',
    birthDate: initial.birthDate ?? '',
    postalCode: initial.postalCode ?? '',
    addressLine1: initial.addressLine1 ?? '',
    addressLine2: initial.addressLine2 ?? '',
    landlinePhone: formatPhoneKR(initial.landlinePhone ?? ''),
    memberType: initial.memberType ?? 'individual',
    adminMemo: initial.adminMemo ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (!form.name.trim() || !form.phone.trim()) {
      setErr('이름과 전화번호는 필수입니다.');
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/admin/customers/${customerId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(),
        phone: form.phone.trim(),
        gender: form.gender,
        birthDate: form.birthDate || null,
        postalCode: form.postalCode || null,
        addressLine1: form.addressLine1 || null,
        addressLine2: form.addressLine2 || null,
        landlinePhone: form.landlinePhone || null,
        memberType: form.memberType,
        adminMemo: form.adminMemo || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? '저장에 실패했습니다.');
      return;
    }
    setMsg('저장되었습니다.');
    router.refresh();
    setTimeout(() => setMsg(null), 2500);
  }

  const disabled = !canWrite || saving;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {!canWrite && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          고객 정보 수정 권한(customers_write)이 없어 조회만 가능합니다.
        </div>
      )}

      <Section title="기본 정보">
        <Field label="이름" required>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              className={`${inputCls} flex-1`}
              disabled={disabled}
              required
            />
            <GenderToggle
              value={form.gender}
              onChange={(g) => update('gender', g)}
              disabled={disabled}
            />
          </div>
        </Field>

        <Grid2>
          <Field label="전화번호" required>
            <input
              type="tel"
              inputMode="numeric"
              value={form.phone}
              onChange={(e) => update('phone', formatPhoneKR(e.target.value))}
              placeholder="01012345678"
              className={inputCls}
              disabled={disabled}
              required
            />
          </Field>
          <Field label="일반전화">
            <input
              type="tel"
              inputMode="numeric"
              value={form.landlinePhone}
              onChange={(e) => update('landlinePhone', formatPhoneKR(e.target.value))}
              placeholder="0212345678"
              className={inputCls}
              disabled={disabled}
            />
          </Field>
        </Grid2>

        <Grid2>
          <Field label="생년월일">
            <input
              type="date"
              value={form.birthDate}
              onChange={(e) => update('birthDate', e.target.value)}
              className={inputCls}
              disabled={disabled}
            />
          </Field>
          <Field label="회원유형">
            <select
              value={form.memberType}
              onChange={(e) => update('memberType', e.target.value)}
              className={inputCls}
              disabled={disabled}
            >
              <option value="individual">개인</option>
              <option value="business">사업자</option>
            </select>
          </Field>
        </Grid2>
      </Section>

      <Section title="주소">
        <Field label="우편번호">
          <div className="flex gap-2">
            <input
              type="text"
              value={form.postalCode}
              readOnly
              placeholder="주소검색을 눌러주세요"
              className={`${inputCls} max-w-[160px] bg-gray-50`}
            />
            <AddressSearchButton
              disabled={disabled}
              onComplete={({ zonecode, address }) =>
                setForm((f) => ({ ...f, postalCode: zonecode, addressLine1: address }))
              }
            />
          </div>
        </Field>
        <Field label="주소">
          <input
            type="text"
            value={form.addressLine1}
            readOnly
            placeholder="주소검색으로 입력됩니다"
            className={`${inputCls} bg-gray-50`}
          />
        </Field>
        <Field label="상세 주소">
          <input
            type="text"
            value={form.addressLine2}
            onChange={(e) => update('addressLine2', e.target.value)}
            placeholder="동·호수 등"
            className={inputCls}
            disabled={disabled}
          />
        </Field>
      </Section>

      <Section title="관리자 메모">
        <Field label="메모" hint="고객에게 노출되지 않는 내부 메모">
          <textarea
            value={form.adminMemo}
            onChange={(e) => update('adminMemo', e.target.value)}
            rows={4}
            className={`${inputCls} resize-y`}
            disabled={disabled}
            placeholder="상담 내용, 특이사항 등"
          />
        </Field>
      </Section>

      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}
      {msg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {msg}
        </div>
      )}

      {canWrite && (
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
          >
            {saving ? '저장 중...' : '변경 사항 저장'}
          </button>
        </div>
      )}
    </form>
  );
}

function GenderToggle({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (g: 'female' | 'male') => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex shrink-0 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
      {(['female', 'male'] as const).map((g) => (
        <button
          key={g}
          type="button"
          onClick={() => onChange(g)}
          disabled={disabled}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
            value === g
              ? g === 'female'
                ? 'bg-pink-500 text-white shadow-sm'
                : 'bg-blue-500 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {g === 'female' ? '여성' : '남성'}
        </button>
      ))}
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-brand-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-500';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="mb-4 text-sm font-bold text-gray-900">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
        {hint && <span className="ml-2 font-normal text-gray-400">{hint}</span>}
      </label>
      {children}
    </div>
  );
}
