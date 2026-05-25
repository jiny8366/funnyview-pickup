'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

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
    phone: initial.phone ?? '',
    gender: initial.gender ?? '',
    birthDate: initial.birthDate ?? '',
    postalCode: initial.postalCode ?? '',
    addressLine1: initial.addressLine1 ?? '',
    addressLine2: initial.addressLine2 ?? '',
    landlinePhone: initial.landlinePhone ?? '',
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
        gender: form.gender || null,
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
        <Grid2>
          <Field label="이름" required>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              className={inputCls}
              disabled={disabled}
              required
            />
          </Field>
          <Field label="전화번호" required>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              className={inputCls}
              disabled={disabled}
              required
            />
          </Field>
        </Grid2>
        <Grid2>
          <Field label="성별">
            <select
              value={form.gender}
              onChange={(e) => update('gender', e.target.value)}
              className={inputCls}
              disabled={disabled}
            >
              <option value="">선택 안 함</option>
              <option value="male">남성</option>
              <option value="female">여성</option>
              <option value="other">기타</option>
            </select>
          </Field>
          <Field label="생년월일">
            <input
              type="date"
              value={form.birthDate}
              onChange={(e) => update('birthDate', e.target.value)}
              className={inputCls}
              disabled={disabled}
            />
          </Field>
        </Grid2>
        <Grid2>
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
          <Field label="일반전화">
            <input
              type="tel"
              value={form.landlinePhone}
              onChange={(e) => update('landlinePhone', e.target.value)}
              className={inputCls}
              disabled={disabled}
            />
          </Field>
        </Grid2>
      </Section>

      <Section title="주소">
        <Grid2>
          <Field label="우편번호">
            <input
              type="text"
              value={form.postalCode}
              onChange={(e) => update('postalCode', e.target.value)}
              className={inputCls}
              disabled={disabled}
            />
          </Field>
        </Grid2>
        <Field label="주소">
          <input
            type="text"
            value={form.addressLine1}
            onChange={(e) => update('addressLine1', e.target.value)}
            className={inputCls}
            disabled={disabled}
          />
        </Field>
        <Field label="상세 주소">
          <input
            type="text"
            value={form.addressLine2}
            onChange={(e) => update('addressLine2', e.target.value)}
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
