/**
 * 카카오 로컬 API — 주소 → 좌표 변환 (geocoding).
 *
 * 키 발급: https://developers.kakao.com → 내 애플리케이션 → REST API 키
 * Vercel 환경변수: KAKAO_REST_API_KEY=...
 *
 * 무료 한도: 일 100,000 / 월 3,000,000 (2026.05 기준).
 *   매장 등록/수정 시점에만 호출하므로 충분.
 */

export interface GeoPoint {
  latitude: number;
  longitude: number;
  /** 카카오가 정규화한 도로명 주소 */
  roadAddress?: string;
  /** 지번 주소 */
  jibunAddress?: string;
  /** 우편번호 (선택) */
  postalCode?: string;
}

const ENDPOINT = 'https://dapi.kakao.com/v2/local/search/address.json';

export async function geocodeAddress(
  address: string,
): Promise<GeoPoint | null> {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) {
    console.warn('[geo] KAKAO_REST_API_KEY 미설정 — geocoding 스킵');
    return null;
  }
  if (!address || address.trim().length < 3) return null;

  try {
    const url = `${ENDPOINT}?query=${encodeURIComponent(address.trim())}`;
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${key}` },
      // 카카오 API 는 5초면 충분
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.warn(`[geo] kakao ${res.status}: ${address}`);
      return null;
    }

    const data = (await res.json()) as {
      documents?: Array<{
        x: string;
        y: string;
        address_name?: string;
        road_address?: { address_name: string; zone_no?: string } | null;
        address?: { address_name: string; zip_code?: string } | null;
      }>;
    };

    const doc = data.documents?.[0];
    if (!doc) return null;

    return {
      latitude: Number(doc.y),
      longitude: Number(doc.x),
      roadAddress: doc.road_address?.address_name,
      jibunAddress: doc.address?.address_name ?? doc.address_name,
      postalCode: doc.road_address?.zone_no,
    };
  } catch (err) {
    console.warn('[geo] kakao error', err);
    return null;
  }
}

/**
 * Haversine 공식 — 두 지점 직선 거리 (km).
 */
export function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371; // 지구 반지름 km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * 표시용 — '1.2km' / '850m'
 */
export function formatDistance(km: number): string {
  if (!Number.isFinite(km) || km < 0) return '';
  if (km < 1) return `${Math.round(km * 1000)}m`;
  if (km < 10) return `${km.toFixed(1)}km`;
  return `${Math.round(km)}km`;
}

/**
 * 도보 시간 추정 — 평균 시속 4km.
 * 자전거/킥보드/지하철 등은 카카오 모빌리티 API 별도 호출 필요.
 * 본 함수는 빠른 UI 표시용 추정치.
 */
export function estimateWalkMinutes(km: number): number {
  return Math.round((km / 4) * 60);
}

/**
 * 자동차 시간 추정 — 평균 시속 25km (도심 + 신호 반영).
 * 정확한 ETA 는 카카오 모빌리티 길찾기 API 필요.
 */
export function estimateDriveMinutes(km: number): number {
  return Math.round((km / 25) * 60);
}

/**
 * 출발지 → 도착지 카카오맵 길찾기 URL (외부 링크).
 *   m: '자동차' | '도보' | '대중교통'
 */
export function kakaoRouteUrl(
  from: { latitude: number; longitude: number; name?: string },
  to: { latitude: number; longitude: number; name?: string },
  mode: 'auto' | 'walk' | 'transit' = 'auto',
): string {
  // 카카오맵 길찾기 deep link
  // sp=출발 ep=도착 lng,lat
  const sp = `${from.longitude},${from.latitude}`;
  const ep = `${to.longitude},${to.latitude}`;
  const by = mode === 'walk' ? 'FOOT' : mode === 'transit' ? 'PUBLICTRANSIT' : 'CAR';
  return `https://map.kakao.com/?sName=${encodeURIComponent(from.name ?? '출발지')}&sX=${from.longitude}&sY=${from.latitude}&eName=${encodeURIComponent(to.name ?? '도착지')}&eX=${to.longitude}&eY=${to.latitude}&by=${by}`;
}

/**
 * 네이버지도 길찾기 URL.
 */
export function naverRouteUrl(
  from: { latitude: number; longitude: number; name?: string },
  to: { latitude: number; longitude: number; name?: string },
  mode: 'auto' | 'walk' | 'transit' = 'auto',
): string {
  // map.naver.com directions
  const m = mode === 'walk' ? 'walk' : mode === 'transit' ? 'transit' : 'car';
  return `https://map.naver.com/p/directions/${from.longitude},${from.latitude},${encodeURIComponent(from.name ?? '출발')}/${to.longitude},${to.latitude},${encodeURIComponent(to.name ?? '도착')}/-/${m}`;
}

/**
 * T맵 자동차 길찾기 (스킴) — 모바일 앱 전용.
 */
export function tmapRouteUrl(
  from: { latitude: number; longitude: number; name?: string },
  to: { latitude: number; longitude: number; name?: string },
): string {
  return `https://apis.openapi.sk.com/tmap/app/routes?appKey=__public__&startName=${encodeURIComponent(from.name ?? '출발')}&startX=${from.longitude}&startY=${from.latitude}&endName=${encodeURIComponent(to.name ?? '도착')}&endX=${to.longitude}&endY=${to.latitude}`;
}
