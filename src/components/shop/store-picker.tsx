'use client';

import { useEffect, useMemo, useState } from 'react';

export interface PickerStore {
  id: string;
  code: string;
  name: string;
  phone: string;
  address: string;
  hasCoord: boolean;
  distanceKm: number | null;
  distanceLabel: string | null;
  driveMinutes: number | null;
  walkMinutes: number | null;
}

type LocationState =
  | { status: 'idle' }
  | { status: 'requesting' }
  | { status: 'ready'; label: string }
  | { status: 'denied'; error: string };

/** 표준 17 시·도 (선택 그리드 표시 순서 = 행정구역 통상 순서). */
const SIDO_ORDER = [
  '서울', '경기', '인천', '강원', '충북', '충남', '대전', '세종',
  '전북', '전남', '광주', '경북', '경남', '대구', '울산', '부산', '제주',
] as const;

/** 주소 첫 토큰(시·도)을 표준 약칭으로 정규화. '경상남도'·'경남' → '경남' 처럼 표기 통일. */
const SIDO_MAP: Record<string, string> = {
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
  return SIDO_MAP[first] ?? first;
}

/**
 * 위치 기반 픽업 매장 선택기 — 장바구니/주문 화면 공용.
 * GPS·주소로 가까운 매장을 추천(거리순)하고, 매장명/주소 검색 + 지역 필터를 제공한다.
 */
export function StorePicker({
  value,
  onSelect,
}: {
  value: string | null;
  onSelect: (id: string, store: PickerStore) => void;
}) {
  const [items, setItems] = useState<PickerStore[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loc, setLoc] = useState<LocationState>({ status: 'idle' });
  const [q, setQ] = useState('');
  const [region, setRegion] = useState('');

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
    try {
      const res = await fetch(url);
      const j = await res.json();
      setItems(j.stores ?? []);
      setTotal(j.total ?? 0);
    } catch {
      setItems([]);
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
        setLoc({ status: 'ready', label: '현재 위치' });
        load(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setLoc({
          status: 'denied',
          error:
            err.code === err.PERMISSION_DENIED
              ? '위치 권한이 거부되었습니다. 설정에서 허용 후 다시 시도해주세요.'
              : '위치를 가져올 수 없습니다.',
        });
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }

  async function useAddressLocation() {
    const address = window.prompt('현재 주소를 입력하세요 (예: 서울 강남구 테헤란로)');
    if (!address) return;
    setLoc({ status: 'requesting' });
    try {
      const res = await fetch('/api/stores/geocode-customer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      if (!res.ok) throw new Error();
      const { latitude, longitude } = await res.json();
      setLoc({ status: 'ready', label: address });
      load(latitude, longitude);
    } catch {
      setLoc({ status: 'denied', error: '주소를 좌표로 변환하지 못했습니다' });
    }
  }

  // 매장이 존재하는 시·도만, 표준 행정구역 순서로 정렬해 노출
  const regions = useMemo(() => {
    if (!items) return [] as string[];
    const present = new Set(
      items.map((s) => extractRegion(s.address)).filter((r): r is string => !!r),
    );
    const ordered = SIDO_ORDER.filter((r) => present.has(r));
    const extras = [...present].filter((r) => !SIDO_ORDER.includes(r as (typeof SIDO_ORDER)[number]));
    return [...ordered, ...extras];
  }, [items]);

  // 선택한 시·도의 매장 수 (그리드 배지)
  const regionCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of items ?? []) {
      const r = extractRegion(s.address);
      if (r) m.set(r, (m.get(r) ?? 0) + 1);
    }
    return m;
  }, [items]);

  const filtered = useMemo(
    () =>
      items?.filter((s) => {
        if (region && extractRegion(s.address) !== region) return false;
        if (
          q &&
          !s.name.toLowerCase().includes(q.toLowerCase()) &&
          !s.address.toLowerCase().includes(q.toLowerCase())
        )
          return false;
        return true;
      }) ?? null,
    [items, q, region],
  );

  return (
    <div className="space-y-3">
      {/* 위치 기반 추천 */}
      <div className="rounded-xl bg-gray-50 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-gray-700">
            {loc.status === 'ready' ? `📍 ${loc.label} 기준 가까운 순` : '가까운 매장을 추천받으세요'}
          </span>
          {loc.status === 'ready' && (
            <button
              type="button"
              onClick={() => {
                setLoc({ status: 'idle' });
                load();
              }}
              className="text-[11px] text-gray-400 hover:text-gray-700"
            >
              초기화
            </button>
          )}
        </div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={useMyLocation}
            disabled={loc.status === 'requesting'}
            className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
          >
            {loc.status === 'requesting' ? '위치 확인 중...' : '📡 내 위치'}
          </button>
          <button
            type="button"
            onClick={useAddressLocation}
            className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-800 hover:bg-gray-50"
          >
            🏠 주소 입력
          </button>
        </div>
        {loc.status === 'denied' && (
          <p className="mt-1.5 text-[11px] text-red-600">{loc.error}</p>
        )}
      </div>

      {/* 지역(시·도) 선택 — 메인 인터페이스 */}
      {regions.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700">지역으로 찾기</span>
            {region && (
              <button
                type="button"
                onClick={() => setRegion('')}
                className="text-[11px] text-gray-400 hover:text-gray-700"
              >
                전체 보기
              </button>
            )}
          </div>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            <RegionCell active={!region} label="전체" count={total} onClick={() => setRegion('')} />
            {regions.map((r) => (
              <RegionCell
                key={r}
                active={region === r}
                label={r}
                count={regionCounts.get(r) ?? 0}
                onClick={() => setRegion(region === r ? '' : r)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 검색 */}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="매장명 또는 주소 검색"
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none"
      />

      {/* 목록 */}
      {!filtered ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">조건에 맞는 매장이 없습니다.</p>
      ) : (
        <>
          <p className="text-[11px] text-gray-400">
            총 {total}개 중 {filtered.length}개
          </p>
          <ul className="max-h-72 space-y-2 overflow-y-auto pr-0.5">
            {filtered.map((s) => {
              const selected = value === s.id;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(s.id, s)}
                    className={`w-full rounded-xl border bg-white px-3 py-2.5 text-left transition-all duration-200 ${
                      selected
                        ? '-translate-y-0.5 border-transparent shadow-[0_10px_28px_-8px_rgba(0,0,0,0.25)] ring-1 ring-black/[0.06]'
                        : 'border-gray-200 hover:-translate-y-px hover:border-gray-200 hover:shadow-[0_6px_18px_-8px_rgba(0,0,0,0.18)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">{s.name}</p>
                        <p className="truncate text-[11px] text-gray-500">{s.address}</p>
                      </div>
                      {selected && <span className="shrink-0 text-sm text-gray-900">✓</span>}
                    </div>
                    {s.distanceLabel && (
                      <p className="mt-1 text-[11px] font-medium text-emerald-700">
                        📍 {s.distanceLabel} · 🚗 {s.driveMinutes}분 · 🚶 {s.walkMinutes}분
                      </p>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function RegionCell({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-2 transition ${
        active
          ? 'border-gray-900 bg-gray-900 text-white'
          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
      }`}
    >
      <span className="text-xs font-medium">{label}</span>
      <span className={`text-[10px] ${active ? 'text-white/70' : 'text-gray-400'}`}>{count}</span>
    </button>
  );
}
