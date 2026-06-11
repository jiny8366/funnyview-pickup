'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PageHeader, PageWrap } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { AddressSearchButton } from '@/components/ui/address-search';

interface StoreDetail {
  id: string;
  code: string;
  name: string;
  phone: string;
  postalCode: string | null;
  addressLine1: string;
  addressLine2: string | null;
  latitude: string | null;
  longitude: string | null;
  businessNumber: string | null;
  representativeName: string | null;
  representativePhone: string | null;
  commissionRate: string;
  groupId: string | null;
  sortOrder: number;
  isActive: boolean;
  groupName: string | null;
  groupCommissionRate: string | null;
}

interface GroupRow {
  id: string;
  name: string;
  commissionRate: string;
}

const inputCls =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none';

export function StoreEditForm({ storeId }: { storeId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
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
    representativePhone: '',
    commissionRate: '0',
    sortOrder: 0,
    groupId: '',
    isActive: true,
  });
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function loadStore() {
    setLoading(true);
    try {
      const [sr, gr] = await Promise.all([
        fetch(`/api/admin/stores/${storeId}`).then((r) => r.json()),
        fetch('/api/admin/store-groups').then((r) => r.json()),
      ]);
      const s: StoreDetail | undefined = sr.store;
      if (s) {
        setForm({
          code: s.code,
          name: s.name ?? '',
          phone: s.phone ?? '',
          addressLine1: s.addressLine1 ?? '',
          addressLine2: s.addressLine2 ?? '',
          postalCode: s.postalCode ?? '',
          latitude: s.latitude ?? '',
          longitude: s.longitude ?? '',
          businessNumber: s.businessNumber ?? '',
          representativeName: s.representativeName ?? '',
          representativePhone: s.representativePhone ?? '',
          commissionRate: s.commissionRate ?? '0',
          sortOrder: s.sortOrder ?? 0,
          groupId: s.groupId ?? '',
          isActive: s.isActive,
        });
      } else {
        setError('매장을 찾을 수 없습니다.');
      }
      setGroups(gr.groups ?? []);
    } catch {
      setError('불러오기 실패');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

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
    setSavedMsg(null);
    if (!form.name.trim() || !form.phone.trim() || !form.addressLine1.trim()) {
      setError('가맹점명, 대표 전화, 주소는 필수입니다.');
      return;
    }
    setSubmitting(true);
    const res = await fetch(`/api/admin/stores/${storeId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        phone: form.phone,
        addressLine1: form.addressLine1,
        addressLine2: form.addressLine2,
        postalCode: form.postalCode,
        latitude: form.latitude,
        longitude: form.longitude,
        businessNumber: form.businessNumber,
        representativeName: form.representativeName,
        representativePhone: form.representativePhone,
        commissionRate: form.commissionRate || '0',
        sortOrder: 0,
        groupId: form.groupId || null,
        isActive: form.isActive,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? '저장 실패');
      return;
    }
    setSavedMsg('저장되었습니다.');
    router.refresh();
  }

  if (loading) {
    return (
      <PageWrap>
        <p className="px-1 py-8 text-sm text-gray-500">불러오는 중…</p>
      </PageWrap>
    );
  }

  return (
    <PageWrap>
      <PageHeader
        title={`픽업가맹점 — ${form.name || form.code}`}
        description={`코드 ${form.code} (변경 불가).`}
        actions={
          <Link href="/admin/stores">
            <Button variant="secondary">목록으로</Button>
          </Link>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Section
          title="기본 정보"
          headerRight={
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <span className={form.isActive ? 'text-emerald-600' : 'text-gray-400'}>
                {form.isActive ? '활성' : '비활성'}
              </span>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => update('isActive', e.target.checked)}
                className="h-4 w-4"
              />
            </label>
          }
        >
          <Grid2>
            <Field label="가맹점 코드" hint="변경 불가">
              <input
                type="text"
                value={form.code}
                readOnly
                className={`${inputCls} bg-gray-50 font-mono text-gray-500`}
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
            <Field label="사업자번호">
              <input
                type="text"
                value={form.businessNumber}
                onChange={(e) => update('businessNumber', e.target.value)}
                placeholder="123-45-67890"
                className={inputCls}
              />
            </Field>
          </Grid2>

          <Grid2>
            <Field label="대표자명">
              <input
                type="text"
                value={form.representativeName}
                onChange={(e) => update('representativeName', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="대표 휴대전화" hint="사업자(대표) 휴대전화번호">
              <input
                type="tel"
                value={form.representativePhone}
                onChange={(e) => update('representativePhone', e.target.value)}
                placeholder="010-0000-0000"
                className={inputCls}
              />
            </Field>
          </Grid2>

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
            <Field label="매장 전체 수수료율 (%)" hint="제품별 오버라이드가 없을 때 적용">
              <input
                type="number"
                step="0.01"
                value={form.commissionRate}
                onChange={(e) => update('commissionRate', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="소속 그룹" hint="그룹 전체율·그룹×제품율이 fallback 으로 적용">
              <select
                value={form.groupId}
                onChange={(e) => update('groupId', e.target.value)}
                className={inputCls}
              >
                <option value="">그룹 없음</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} (그룹 전체 {g.commissionRate}%)
                  </option>
                ))}
              </select>
            </Field>
          </Grid2>
        </Section>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          {savedMsg && <span className="text-sm text-emerald-600">{savedMsg}</span>}
          <Link href="/admin/stores">
            <Button variant="secondary" type="button">취소</Button>
          </Link>
          <Button type="submit" disabled={submitting}>
            {submitting ? '저장 중...' : '저장'}
          </Button>
        </div>
      </form>
    </PageWrap>
  );
}

function Section({
  title,
  headerRight,
  children,
}: {
  title: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        {headerRight}
      </div>
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
