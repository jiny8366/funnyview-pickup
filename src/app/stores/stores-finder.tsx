'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { IconSearch, IconStore } from '@/components/ui/icons';
import { setPreferredStore } from '@/lib/cart/pickup-store';

interface NearbyStore {
  id: string;
  code: string;
  name: string;
  phone: string;
  address: string;
  hasCoord: boolean;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
  distanceLabel: string | null;
  driveMinutes: number | null;
  walkMinutes: number | null;
  mapLinks: { kakao: string | null; naver: string | null; tmap: string | null };
}

type LocationState =
  | { status: 'idle' }
  | { status: 'requesting' }
  | { status: 'ready'; lat: number; lng: number; label: string }
  | { status: 'denied'; error: string };

export function StoresFinder() {
  const [items, setItems] = useState<NearbyStore[] | null>(null);
  const [region, setRegion] = useState('');
  const [q, setQ] = useState('');
  const [loc, setLoc] = useState<LocationState>({ status: 'idle' });
  const [total, setTotal] = useState(0);

  useEffect(() => {
    load();
  }, []);

  async function load(lat?: number, lng?: number) {
    setItems(null);
    const url = new URL('/api/stores/nearby', window.location.origin);
    if (lat != null && lng != null) {
      url.searchParams.set('lat', String(lat));
      url.searchParams.set('lng', String(lng));
    }
    url.searchParams.set('limit', '100');
    const res = await fetch(url);
    if (res.ok) {
      const j = await res.json();
      setItems(j.stores ?? []);
      setTotal(j.total ?? 0);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLoc({ status: 'denied', error: '브라우저가 위치 정보를 지원하지 않습니다' });
      return;
    }
    setLoc({ status: 'requesting' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLoc({ status: 'ready', lat, lng, label: '현재 위치' });
        load(lat, lng);
      },
      (err) => {
        setLoc({
          status: 'denied',
          error: err.code === err.PERMISSION_DENIED
            ? '위치 권한이 거부되었습니다. 브라우저 설정에서 허용 후 다시 시도해주세요.'
            : '위치를 가져올 수 없습니다.',
        });
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }

  async function useAddressLocation() {
    const address = prompt('현재 주소를 입력하세요 (예: 서울 강남구 테헤란로)');
    if (!address) return;
    setLoc({ status: 'requesting' });
    const res = await fetch('/api/stores/geocode-customer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address }),
    });
    if (!res.ok) {
      setLoc({ status: 'denied', error: '주소를 좌표로 변환하지 못했습니다' });
      return;
    }
    const { latitude, longitude } = await res.json();
    setLoc({ status: 'ready', lat: latitude, lng: longitude, label: address });
    load(latitude, longitude);
  }

  // 지역 추출
  const regions = items
    ? Array.from(
        new Set(
          items
            .map((s) => extractRegion(s.address))
            .filter((r): r is string => !!r),
        ),
      ).sort()
    : [];

  const filtered = items?.filter((s) => {
    if (region && extractRegion(s.address) !== region) return false;
    if (q && !s.name.toLowerCase().includes(q.toLowerCase()) && !s.address.toLowerCase().includes(q.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="mt-6 space-y-4">
      {/* 위치 사용 박스 */}
      <Card>
        <CardBody>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">📍 내 위치 기준 정렬</div>
              {loc.status === 'ready' ? (
                <div className="mt-0.5 text-xs text-emerald-700">
                  {loc.label} 기준 가까운 매장 순
                </div>
              ) : loc.status === 'denied' ? (
                <div className="mt-0.5 text-xs text-red-600">{loc.error}</div>
              ) : (
                <div className="mt-0.5 text-xs text-gray-500">
                  현재 위치 또는 주소를 입력하면 가까운 순으로 정렬됩니다
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={useMyLocation}
                disabled={loc.status === 'requesting'}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
              >
                {loc.status === 'requesting' ? '위치 확인 중...' : '📡 GPS 위치 사용'}
              </button>
              <button
                type="button"
                onClick={useAddressLocation}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-gray-50"
              >
                🏠 주소 입력
              </button>
              {loc.status === 'ready' && (
                <button
                  type="button"
                  onClick={() => {
                    setLoc({ status: 'idle' });
                    load();
                  }}
                  className="inline-flex h-9 items-center px-3 text-xs text-gray-500 hover:text-gray-900"
                >
                  ✕ 위치 초기화
                </button>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* 검색 + 지역 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
          <IconSearch size={18} className="text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="매장명 또는 주소로 검색"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              className="text-xs text-gray-400 hover:text-gray-900"
            >
              ✕
            </button>
          )}
        </div>

        {regions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <Chip active={!region} onClick={() => setRegion('')} label="전체" />
            {regions.map((r) => (
              <Chip
                key={r}
                active={region === r}
                onClick={() => setRegion(r)}
                label={r}
              />
            ))}
          </div>
        )}
      </div>

      <div className="text-xs text-gray-500">
        총 {total}개 가맹점 중{' '}
        <span className="font-semibold text-gray-900">{filtered?.length ?? 0}</span>개 표시
      </div>

      {!filtered ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<IconStore size={28} />}
          title="조건에 맞는 매장이 없습니다"
          description="검색어 또는 지역 필터를 바꿔보세요."
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <li key={s.id}>
              <StoreCard store={s} userPos={loc.status === 'ready' ? { lat: loc.lat, lng: loc.lng } : null} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StoreCard({
  store,
  userPos,
}: {
  store: NearbyStore;
  userPos: { lat: number; lng: number } | null;
}) {
  const router = useRouter();
  const hasDistance = store.distanceKm != null;

  return (
    <Card className="h-full">
      <CardBody className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium text-brand-600">
              {extractRegion(store.address) ?? store.code}
            </div>
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

        {/* 거리 / 시간 */}
        {hasDistance ? (
          <div className="mt-2 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs">
            <div className="font-semibold text-emerald-800">
              📍 {store.distanceLabel}
            </div>
            <div className="mt-0.5 text-[11px] text-emerald-700">
              🚗 약 {store.driveMinutes}분 · 🚶 약 {store.walkMinutes}분
              <span className="ml-1 text-emerald-600/70">(추정)</span>
            </div>
          </div>
        ) : userPos && !store.hasCoord ? (
          <div className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700">
            ⚠ 매장 좌표 미등록 — 정확한 거리 계산 불가
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {store.mapLinks.kakao && (
            <a
              href={
                userPos && store.hasCoord
                  ? kakaoRouteForCard(userPos, store)
                  : store.mapLinks.kakao
              }
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-yellow-100 px-2.5 py-1 text-[11px] text-yellow-800 hover:bg-yellow-200"
            >
              {userPos && store.hasCoord ? '카카오 길찾기' : '카카오맵'}
            </a>
          )}
          {store.mapLinks.naver && (
            <a
              href={
                userPos && store.hasCoord
                  ? naverRouteForCard(userPos, store)
                  : store.mapLinks.naver
              }
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-green-100 px-2.5 py-1 text-[11px] text-green-800 hover:bg-green-200"
            >
              {userPos && store.hasCoord ? '네이버 길찾기' : '네이버지도'}
            </a>
          )}
          {store.mapLinks.tmap && (
            <a
              href={store.mapLinks.tmap}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] text-red-800 hover:bg-red-200"
            >
              T맵
            </a>
          )}
        </div>

        <div className="mt-auto pt-3">
          <button
            type="button"
            onClick={() => {
              setPreferredStore({ id: store.id, name: store.name, address: store.address });
              router.push('/products');
            }}
            className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-brand-600 text-sm font-medium text-white hover:bg-brand-700"
          >
            이 매장으로 주문
          </button>
        </div>
      </CardBody>
    </Card>
  );
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'rounded-full bg-brand-600 px-3 py-1 text-xs font-medium text-white'
          : 'rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700 hover:bg-gray-50'
      }
    >
      {label}
    </button>
  );
}

/** 주소 첫 토큰(시·도)을 표준 약칭으로. '경상남도'→'경남', '전라북도'→'전북' 등. */
const SIDO_ABBR: Record<string, string> = {
  서울: '서울', 서울특별시: '서울',
  부산: '부산', 부산광역시: '부산',
  대구: '대구', 대구광역시: '대구',
  인천: '인천', 인천광역시: '인천',
  광주: '광주', 광주광역시: '광주',
  대전: '대전', 대전광역시: '대전',
  울산: '울산', 울산광역시: '울산',
  세종: '세종', 세종시: '세종', 세종특별자치시: '세종',
  경기: '경기', 경기도: '경기',
  강원: '강원', 강원도: '강원', 강원특별자치도: '강원',
  충북: '충북', 충청북도: '충북',
  충남: '충남', 충청남도: '충남',
  전북: '전북', 전라북도: '전북', 전북특별자치도: '전북',
  전남: '전남', 전라남도: '전남',
  경북: '경북', 경상북도: '경북',
  경남: '경남', 경상남도: '경남',
  제주: '제주', 제주도: '제주', 제주특별자치도: '제주',
};

function extractRegion(address: string | null): string | null {
  if (!address) return null;
  const first = address.trim().split(/\s+/)[0] || '';
  return SIDO_ABBR[first] ?? first;
}

function kakaoRouteForCard(
  userPos: { lat: number; lng: number },
  store: NearbyStore,
): string {
  if (!store.latitude || !store.longitude) return '';
  // 카카오맵 길찾기 deep link
  return `https://map.kakao.com/?sX=${userPos.lng}&sY=${userPos.lat}&sName=${encodeURIComponent('내 위치')}&eX=${store.longitude}&eY=${store.latitude}&eName=${encodeURIComponent(store.name)}&by=CAR`;
}

function naverRouteForCard(
  userPos: { lat: number; lng: number },
  store: NearbyStore,
): string {
  if (!store.latitude || !store.longitude) return '';
  return `https://map.naver.com/p/directions/${userPos.lng},${userPos.lat},${encodeURIComponent('내 위치')}/${store.longitude},${store.latitude},${encodeURIComponent(store.name)}/-/car`;
}
