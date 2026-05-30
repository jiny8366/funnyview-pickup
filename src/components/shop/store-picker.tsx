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

function extractRegion(address: string | null): string | null {
  if (!address) return null;
  const first = address.trim().split(/\s+/)[0] || '';
  return first.replace(/특별시|광역시|특별자치시|특별자치도|도$/, '').replace(/시$/, '');
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

  const regions = useMemo(
    () =>
      items
        ? Array.from(
            new Set(items.map((s) => extractRegion(s.address)).filter((r): r is string => !!r)),
          ).sort()
        : [],
    [items],
  );

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

      {/* 검색 */}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="매장명 또는 주소 검색"
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none"
      />

      {/* 지역 필터 */}
      {regions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <RegionChip active={!region} label="전체" onClick={() => setRegion('')} />
          {regions.map((r) => (
            <RegionChip key={r} active={region === r} label={r} onClick={() => setRegion(r)} />
          ))}
        </div>
      )}

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
                    className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                      selected
                        ? 'border-gray-900 bg-gray-900/[0.03] ring-1 ring-gray-900'
                        : 'border-gray-200 hover:border-gray-400'
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

function RegionChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'rounded-full bg-gray-900 px-2.5 py-1 text-[11px] font-medium text-white'
          : 'rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] text-gray-600 hover:bg-gray-50'
      }
    >
      {label}
    </button>
  );
}
