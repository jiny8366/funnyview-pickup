'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PageHeader, PageWrap } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';

export default function NewStorePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    code: '',
    name: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    postalCode: '',
    latitude: '',
    longitude: '',
    businessNumber: '',
    representativeName: '',
    commissionRate: '10',
    sortOrder: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim() || !form.phone.trim() || !form.addressLine1.trim()) {
      setError('이름, 전화번호, 주소는 필수입니다.');
      return;
    }
    setSubmitting(true);
    const res = await fetch('/api/admin/stores', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: form.code.trim() || undefined,
        name: form.name,
        phone: form.phone,
        addressLine1: form.addressLine1,
        addressLine2: form.addressLine2 || undefined,
        postalCode: form.postalCode || undefined,
        latitude: form.latitude || undefined,
        longitude: form.longitude || undefined,
        businessNumber: form.businessNumber || undefined,
        representativeName: form.representativeName || undefined,
        commissionRate: form.commissionRate || '0',
        sortOrder: Number(form.sortOrder) || 0,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? '저장 실패');
      return;
    }
    router.push('/admin/stores');
    router.refresh();
  }

  return (
    <PageWrap>
      <PageHeader
        title="픽업가맹점 등록"
        description="신규 가맹점 정보를 입력합니다. 좌표는 비워두어도 OK (지도 표시 시 주소로 fallback)."
        actions={
          <Link href="/admin/stores">
            <Button variant="secondary">목록으로</Button>
          </Link>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Section title="기본 정보">
          <Grid2>
            <Field label="가맹점 코드" hint="비워두면 ST-NNNN 자동 부여">
              <input
                type="text"
                value={form.code}
                onChange={(e) => update('code', e.target.value)}
                placeholder="ST-0010"
                className={inputCls}
              />
            </Field>
            <Field label="가맹점명" required>
              <input
                type="text"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="강남점"
                className={inputCls}
                required
              />
            </Field>
          </Grid2>

          <Grid2>
            <Field label="전화번호" required>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="02-1234-5678"
                className={inputCls}
                required
              />
            </Field>
            <Field label="우편번호">
              <input
                type="text"
                value={form.postalCode}
                onChange={(e) => update('postalCode', e.target.value)}
                placeholder="06234"
                className={inputCls}
              />
            </Field>
          </Grid2>

          <Field label="주소" required>
            <input
              type="text"
              value={form.addressLine1}
              onChange={(e) => update('addressLine1', e.target.value)}
              placeholder="서울 강남구 테헤란로 100"
              className={inputCls}
              required
            />
          </Field>
          <Field label="상세 주소">
            <input
              type="text"
              value={form.addressLine2}
              onChange={(e) => update('addressLine2', e.target.value)}
              placeholder="3층 301호"
              className={inputCls}
            />
          </Field>
        </Section>

        <Section title="좌표 (선택)">
          <Grid2>
            <Field label="위도 (latitude)">
              <input
                type="text"
                inputMode="decimal"
                value={form.latitude}
                onChange={(e) => update('latitude', e.target.value)}
                placeholder="37.5006"
                className={inputCls}
              />
            </Field>
            <Field label="경도 (longitude)">
              <input
                type="text"
                inputMode="decimal"
                value={form.longitude}
                onChange={(e) => update('longitude', e.target.value)}
                placeholder="127.0364"
                className={inputCls}
              />
            </Field>
          </Grid2>
        </Section>

        <Section title="사업자 정보 (정산 거래전표용)">
          <Grid2>
            <Field label="사업자번호">
              <input
                type="text"
                value={form.businessNumber}
                onChange={(e) => update('businessNumber', e.target.value)}
                placeholder="123-45-67890"
                className={inputCls}
              />
            </Field>
            <Field label="대표자명">
              <input
                type="text"
                value={form.representativeName}
                onChange={(e) => update('representativeName', e.target.value)}
                className={inputCls}
              />
            </Field>
          </Grid2>
        </Section>

        <Section title="운영 설정">
          <Grid2>
            <Field label="수수료율 (%)" hint="가맹점 정산 시 지급되는 비율">
              <input
                type="number"
                step="0.01"
                value={form.commissionRate}
                onChange={(e) => update('commissionRate', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="정렬 순서" hint="낮을수록 우선 노출 (0 이 가장 위)">
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => update('sortOrder', Number(e.target.value))}
                className={inputCls}
              />
            </Field>
          </Grid2>
        </Section>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Link href="/admin/stores">
            <Button variant="secondary">취소</Button>
          </Link>
          <Button type="submit" disabled={submitting}>
            {submitting ? '저장 중...' : '가맹점 등록'}
          </Button>
        </div>
      </form>
    </PageWrap>
  );
}

const inputCls =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-brand-500 focus:outline-none';

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
