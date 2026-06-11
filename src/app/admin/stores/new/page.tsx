'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PageHeader, PageWrap } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { AddressSearchButton } from '@/components/ui/address-search';

export default function NewStorePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    postalCode: '',
    latitude: '',
    longitude: '',
    businessNumber: '',
    representativeName: '',
    representativePhone: '',
    commissionRate: '10',
    sortOrder: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // 주소 선택 시: 우편번호·기본주소 채우고 좌표를 주소기반으로 자동 지오코딩
  async function onAddressComplete(zonecode: string, address: string) {
    setForm((f) => ({ ...f, postalCode: zonecode, addressLine1: address }));
    setGeoMsg('좌표 조회 중…');
    try {
      const res = await fetch('/api/admin/geocode', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      if (!res.ok) {
        setGeoMsg('좌표 자동조회 실패 — 저장은 가능합니다(지도 표시 시 주소 fallback).');
        return;
      }
      const geo = await res.json();
      setForm((f) => ({
        ...f,
        latitude: geo.latitude != null ? String(geo.latitude) : '',
        longitude: geo.longitude != null ? String(geo.longitude) : '',
        postalCode: geo.postalCode || zonecode,
      }));
      setGeoMsg(`좌표 자동입력됨 (${geo.latitude}, ${geo.longitude})`);
    } catch {
      setGeoMsg('좌표 자동조회 실패 — 저장은 가능합니다.');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim() || !form.phone.trim() || !form.addressLine1.trim()) {
      setError('가맹점명, 대표 전화, 주소는 필수입니다.');
      return;
    }
    setSubmitting(true);
    const res = await fetch('/api/admin/stores', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        // code 미전송 → 서버가 ST-NNNN 자동 부여
        name: form.name,
        phone: form.phone,
        addressLine1: form.addressLine1,
        addressLine2: form.addressLine2 || undefined,
        postalCode: form.postalCode || undefined,
        latitude: form.latitude || undefined,
        longitude: form.longitude || undefined,
        businessNumber: form.businessNumber || undefined,
        representativeName: form.representativeName || undefined,
        representativePhone: form.representativePhone || undefined,
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
        description="가맹점 코드는 자동 부여(ST-NNNN)되고, 좌표는 주소를 선택하면 자동 입력됩니다."
        actions={
          <Link href="/admin/stores">
            <Button variant="secondary">목록으로</Button>
          </Link>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Section title="기본 정보">
          <Grid2>
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
            <Field label="대표 전화" required hint="매장 대표번호">
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="02-1234-5678"
                className={inputCls}
                required
              />
            </Field>
          </Grid2>

          {/* 사업자 정보 — 기본 정보에 통합 */}
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
          <Field label="대표 휴대전화" hint="사업자(대표) 휴대전화번호">
            <input
              type="tel"
              value={form.representativePhone}
              onChange={(e) => update('representativePhone', e.target.value)}
              placeholder="010-0000-0000"
              className={inputCls}
            />
          </Field>

          {/* 주소 — 고객 회원가입과 동일한 우편번호 검색 + 좌표 자동입력 */}
          <Field label="주소" required>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={form.postalCode}
                  placeholder="우편번호"
                  readOnly
                  className={`${inputCls} w-32 bg-gray-50`}
                />
                <AddressSearchButton
                  onComplete={({ zonecode, address }) => onAddressComplete(zonecode, address)}
                  className="h-9 shrink-0 rounded-lg border border-gray-300 bg-gray-100 px-3 text-sm font-medium text-gray-700 hover:bg-gray-200"
                />
              </div>
              <input
                type="text"
                value={form.addressLine1}
                placeholder="기본주소 (주소 검색)"
                readOnly
                className={`${inputCls} bg-gray-50`}
                required
              />
              <input
                type="text"
                value={form.addressLine2}
                onChange={(e) => update('addressLine2', e.target.value)}
                placeholder="상세 주소 (3층 301호 등)"
                className={inputCls}
              />
              {geoMsg && <p className="text-xs text-gray-500">📍 {geoMsg}</p>}
            </div>
          </Field>
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
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none';

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
