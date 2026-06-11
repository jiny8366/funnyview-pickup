'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
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

interface LensRow {
  id: string;
  brand: string;
  name: string;
  productCode: string;
}

interface StoreProductCommission {
  id: string;
  lensId: string;
  commissionRate: string;
  brand: string;
  name: string;
  productCode: string;
  inheritedGroupProductRate: string | null;
}

const inputCls =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-brand-500 focus:outline-none';

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
        setGroupOverallRate(s.groupCommissionRate);
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

  const [groupOverallRate, setGroupOverallRate] = useState<string | null>(null);

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
        sortOrder: Number(form.sortOrder) || 0,
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
    // 그룹 변경 시 상속 참고치 갱신을 위해 다시 로드
    const g = groups.find((x) => x.id === form.groupId);
    setGroupOverallRate(g?.commissionRate ?? null);
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
        title={`가맹점 수정 — ${form.name || form.code}`}
        description={`코드 ${form.code} (변경 불가). 기본 정보·운영 설정·제품별 수수료율을 관리합니다.`}
        actions={
          <Link href="/admin/stores">
            <Button variant="secondary">목록으로</Button>
          </Link>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Section title="기본 정보">
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
            <Field label="정렬 순서" hint="낮을수록 우선 노출 (0 이 가장 위)">
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => update('sortOrder', Number(e.target.value))}
                className={inputCls}
              />
            </Field>
          </Grid2>
          <Grid2>
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
            <Field label="활성 상태">
              <label className="flex h-[38px] items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => update('isActive', e.target.checked)}
                />
                활성 (체크 해제 시 비활성)
              </label>
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

      {/* 제품별 수수료율 (매장 override) */}
      <div className="mt-8">
        <StoreProductCommissions
          storeId={storeId}
          storeOverallRate={form.commissionRate}
          groupOverallRate={groupOverallRate}
        />
      </div>
    </PageWrap>
  );
}

/** 매장 × 제품 수수료율 오버라이드 섹션. */
function StoreProductCommissions({
  storeId,
  storeOverallRate,
  groupOverallRate,
}: {
  storeId: string;
  storeOverallRate: string;
  groupOverallRate: string | null;
}) {
  const [items, setItems] = useState<StoreProductCommission[]>([]);
  const [lenses, setLenses] = useState<LensRow[]>([]);
  const [query, setQuery] = useState('');
  const [selectedLensId, setSelectedLensId] = useState('');
  const [rate, setRate] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    try {
      const [cr, lr] = await Promise.all([
        fetch(`/api/admin/stores/${storeId}/product-commissions`).then((r) => r.json()),
        fetch('/api/admin/lenses').then((r) => r.json()),
      ]);
      setItems(cr.commissions ?? []);
      setLenses(
        (lr.lenses ?? []).map((l: LensRow) => ({
          id: l.id,
          brand: l.brand,
          name: l.name,
          productCode: l.productCode,
        })),
      );
    } catch {
      setMsg('불러오기 실패');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const overriddenIds = useMemo(
    () => new Set(items.map((i) => i.lensId)),
    [items],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return lenses
      .filter(
        (l) =>
          l.brand.toLowerCase().includes(q) ||
          l.name.toLowerCase().includes(q) ||
          l.productCode.toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [query, lenses]);

  // 선택 제품의 상속(fallback) 참고치 — placeholder/힌트용
  const inheritedHint = useMemo(() => {
    const so = Number(storeOverallRate);
    if (Number.isFinite(so) && so > 0) return `매장 전체 ${storeOverallRate}%`;
    if (groupOverallRate != null && Number(groupOverallRate) > 0)
      return `그룹 전체 ${groupOverallRate}%`;
    return '0%';
  }, [storeOverallRate, groupOverallRate]);

  async function save() {
    if (!selectedLensId) {
      setMsg('제품을 선택하세요');
      return;
    }
    if (rate.trim() === '' || Number.isNaN(Number(rate))) {
      setMsg('수수료율을 입력하세요');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/stores/${storeId}/product-commissions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lensId: selectedLensId, commissionRate: rate.trim() }),
      });
      if (!res.ok) throw new Error();
      setMsg('저장되었습니다');
      setSelectedLensId('');
      setQuery('');
      setRate('');
      await load();
    } catch {
      setMsg('저장 실패');
    } finally {
      setBusy(false);
    }
  }

  async function remove(lensId: string) {
    if (typeof window !== 'undefined' && !window.confirm('이 제품 오버라이드를 삭제할까요? 삭제하면 상속값이 적용됩니다.')) {
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(
        `/api/admin/stores/${storeId}/product-commissions?lensId=${encodeURIComponent(lensId)}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setMsg('삭제 실패');
    } finally {
      setBusy(false);
    }
  }

  function inheritedFor(item: StoreProductCommission): string {
    if (item.inheritedGroupProductRate != null && Number(item.inheritedGroupProductRate) >= 0)
      return `그룹×제품 ${item.inheritedGroupProductRate}%`;
    return inheritedHint;
  }

  const selectedLens = lenses.find((l) => l.id === selectedLensId);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="mb-1 text-sm font-bold text-gray-900">제품별 수수료율 (매장 오버라이드)</h2>
      <p className="mb-4 text-xs text-gray-500">
        여기서 설정한 값이 해당 제품의 매장 정산율로 우선 적용됩니다(가장 구체적). 미설정 제품은 상속값(그룹×제품 → 매장 전체 → 그룹 전체)이 적용됩니다.
      </p>

      {/* 제품 검색 + 추가 */}
      <div className="mb-4 grid gap-2 md:grid-cols-[1fr_140px_auto]">
        <div className="relative">
          <input
            type="text"
            value={selectedLens ? `${selectedLens.brand} ${selectedLens.name} (${selectedLens.productCode})` : query}
            onChange={(e) => {
              setSelectedLensId('');
              setQuery(e.target.value);
            }}
            placeholder="제품 검색 (브랜드/제품명/코드)"
            className={inputCls}
          />
          {!selectedLensId && filtered.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              {filtered.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLensId(l.id);
                      setQuery('');
                    }}
                    disabled={overriddenIds.has(l.id)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-40"
                  >
                    <span>
                      <span className="font-medium text-gray-900">{l.brand}</span>{' '}
                      <span className="text-gray-700">{l.name}</span>{' '}
                      <span className="font-mono text-xs text-gray-400">{l.productCode}</span>
                    </span>
                    {overriddenIds.has(l.id) && (
                      <span className="text-xs text-gray-400">이미 설정됨</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <input
          type="number"
          step="0.01"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          placeholder={`상속: ${inheritedHint}`}
          className={inputCls}
        />
        <Button type="button" onClick={save} disabled={busy || !selectedLensId}>
          추가/저장
        </Button>
      </div>
      {msg && <p className="mb-3 text-sm text-gray-600">{msg}</p>}

      {/* 목록 */}
      {items.length === 0 ? (
        <p className="px-1 py-4 text-sm text-gray-500">설정된 제품별 오버라이드가 없습니다.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">브랜드</th>
                <th className="px-3 py-2 text-left">제품명</th>
                <th className="px-3 py-2 text-left">코드</th>
                <th className="px-3 py-2 text-right">매장 수수료율</th>
                <th className="px-3 py-2 text-left">상속값(참고)</th>
                <th className="px-3 py-2 text-right">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((it) => (
                <tr key={it.id}>
                  <td className="px-3 py-2 font-medium text-gray-900">{it.brand}</td>
                  <td className="px-3 py-2 text-gray-700">{it.name}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-400">{it.productCode}</td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={it.commissionRate}
                      onBlur={async (e) => {
                        const v = e.target.value.trim();
                        if (v === '' || v === it.commissionRate || Number.isNaN(Number(v))) return;
                        setBusy(true);
                        await fetch(`/api/admin/stores/${storeId}/product-commissions`, {
                          method: 'POST',
                          headers: { 'content-type': 'application/json' },
                          body: JSON.stringify({ lensId: it.lensId, commissionRate: v }),
                        });
                        setBusy(false);
                        await load();
                      }}
                      className="w-24 rounded border border-gray-200 px-2 py-1 text-right text-sm focus:border-brand-500 focus:outline-none"
                    />
                    <span className="ml-1 text-gray-400">%</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-400">{inheritedFor(it)}</td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="danger"
                      type="button"
                      onClick={() => remove(it.lensId)}
                      disabled={busy}
                    >
                      삭제
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

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
