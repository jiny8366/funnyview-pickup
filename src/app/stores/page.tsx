import Link from 'next/link';
import { asc, eq, isNull, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { stores } from '@/db/schema';
import { mapLinks } from '@/lib/utils/map-url';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { IconStore } from '@/components/ui/icons';
import { StoresFilter } from './stores-filter';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '픽업 매장 찾기 — Funnyview Pickup',
  description: '주변 픽업 가맹점을 찾아보세요. 콘택트렌즈 주문 후 가까운 매장에서 픽업할 수 있습니다.',
};

function regionOf(addr: string | null): string {
  if (!addr) return '기타';
  const first = addr.trim().split(/\s+/)[0] || '기타';
  // '서울특별시', '경기도' 등에서 첫 2글자 추출 (강원도 → 강원)
  const norm = first
    .replace(/특별시|광역시|특별자치시|특별자치도|도$/, '')
    .replace(/시$/, '');
  return norm || first;
}

export default async function PublicStoresPage({
  searchParams,
}: {
  searchParams?: { region?: string; q?: string };
}) {
  const rows = await db
    .select()
    .from(stores)
    .where(and(eq(stores.isActive, true), isNull(stores.deletedAt)))
    .orderBy(asc(stores.sortOrder), asc(stores.name));

  const enriched = rows.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    phone: s.phone,
    address: [s.addressLine1, s.addressLine2].filter(Boolean).join(' '),
    region: regionOf(s.addressLine1),
    businessHours: s.businessHours as Record<string, { open: string; close: string }> | null,
    mapLinks: mapLinks(s),
  }));

  const regions = Array.from(new Set(enriched.map((s) => s.region))).sort();

  const q = (searchParams?.q ?? '').trim().toLowerCase();
  const region = searchParams?.region ?? '';

  const filtered = enriched.filter((s) => {
    if (region && s.region !== region) return false;
    if (q && !s.name.toLowerCase().includes(q) && !s.address.toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">픽업 매장 찾기</h1>
        <p className="mt-2 text-sm text-gray-500">
          주문하신 콘택트렌즈를 가까운 가맹점에서 안경사 상담과 함께 픽업하실 수 있습니다.
        </p>
      </header>

      <StoresFilter regions={regions} initialRegion={region} initialQ={q} />

      <div className="mt-3 mb-4 text-xs text-gray-500">
        총 {enriched.length}개 가맹점 중 <span className="font-semibold text-gray-900">{filtered.length}</span>개 표시
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<IconStore size={28} />}
          title="검색 결과가 없습니다"
          description="다른 지역 또는 검색어로 시도해보세요."
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <li key={s.id}>
              <StoreCard store={s} />
            </li>
          ))}
        </ul>
      )}

      <section className="mt-10 rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">
        <h2 className="text-sm font-semibold text-gray-900">픽업 서비스 안내</h2>
        <ul className="mt-2 space-y-1 text-xs">
          <li>· 의료기기법에 따라 안경사 또는 안과의사의 처방전 (6개월 이내) 이 필요합니다.</li>
          <li>· 만 14세 미만은 픽업 서비스 이용이 제한됩니다.</li>
          <li>· 매장 방문 시 안경사 상담 + 가이드 후 수령합니다.</li>
        </ul>
      </section>
    </div>
  );
}

function StoreCard({
  store,
}: {
  store: {
    id: string;
    code: string;
    name: string;
    phone: string;
    address: string;
    region: string;
    businessHours: Record<string, { open: string; close: string }> | null;
    mapLinks: { kakao: string | null; naver: string | null; tmap: string | null };
  };
}) {
  const todayHours = todayBusinessHours(store.businessHours);

  return (
    <Card className="h-full">
      <CardBody className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium text-brand-600">{store.region}</div>
            <h3 className="mt-0.5 text-base font-semibold text-gray-900">{store.name}</h3>
          </div>
          <a
            href={`tel:${store.phone}`}
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-brand-50 px-3 text-xs font-medium text-brand-700 hover:bg-brand-100"
          >
            📞 통화
          </a>
        </div>

        <p className="mt-2 text-xs text-gray-600">{store.address}</p>

        {todayHours && (
          <p className="mt-1 text-[11px] text-gray-500">
            오늘 영업: {todayHours.open} ~ {todayHours.close}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {store.mapLinks.kakao && (
            <a
              href={store.mapLinks.kakao}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-yellow-100 px-2.5 py-1 text-[11px] text-yellow-800"
            >
              카카오맵
            </a>
          )}
          {store.mapLinks.naver && (
            <a
              href={store.mapLinks.naver}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-green-100 px-2.5 py-1 text-[11px] text-green-800"
            >
              네이버지도
            </a>
          )}
          {store.mapLinks.tmap && (
            <a
              href={store.mapLinks.tmap}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] text-red-800"
            >
              T맵
            </a>
          )}
        </div>

        <div className="mt-auto pt-3">
          <Link
            href={`/order/new?store=${store.id}`}
            className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-brand-600 text-sm font-medium text-white hover:bg-brand-700"
          >
            이 매장으로 주문
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}

const KO_DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function todayBusinessHours(
  hours: Record<string, { open: string; close: string }> | null,
): { open: string; close: string } | null {
  if (!hours) return null;
  const key = KO_DAY_KEYS[new Date().getDay()];
  return hours[key] ?? null;
}
