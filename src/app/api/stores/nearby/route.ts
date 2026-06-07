import { NextResponse } from 'next/server';
import { and, eq, isNull, isNotNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { stores } from '@/db/schema';
import {
  estimateDriveMinutes,
  estimateWalkMinutes,
  formatDistance,
  haversineKm,
} from '@/lib/geo/kakao';
import { mapLinks } from '@/lib/utils/map-url';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stores/nearby?lat=37.5&lng=127.0&limit=20
 *
 * lat/lng 없으면 모든 매장 (좌표 없는 매장 포함, 거리 null).
 * 있으면 좌표 있는 매장만 거리 계산해 가까운 순으로 정렬.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const latParam = url.searchParams.get('lat');
  const lngParam = url.searchParams.get('lng');
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '30')));

  const userPos =
    latParam && lngParam
      ? { latitude: Number(latParam), longitude: Number(lngParam) }
      : null;

  const rows = await db
    .select()
    .from(stores)
    .where(and(eq(stores.isActive, true), isNull(stores.deletedAt)))
    .orderBy(stores.sortOrder, stores.name);

  const enriched = rows.map((s) => {
    const lat = s.latitude == null ? null : Number(s.latitude);
    const lng = s.longitude == null ? null : Number(s.longitude);
    const hasCoord = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);

    let distanceKm: number | null = null;
    let driveMin: number | null = null;
    let walkMin: number | null = null;
    if (userPos && hasCoord) {
      distanceKm = haversineKm(userPos, { latitude: lat!, longitude: lng! });
      driveMin = estimateDriveMinutes(distanceKm);
      walkMin = estimateWalkMinutes(distanceKm);
    }

    return {
      id: s.id,
      code: s.code,
      name: s.name,
      phone: s.phone,
      address: [s.addressLine1, s.addressLine2].filter(Boolean).join(' '),
      addressLine1: s.addressLine1,
      postalCode: s.postalCode,
      latitude: lat,
      longitude: lng,
      hasCoord,
      distanceKm,
      distanceLabel: distanceKm != null ? formatDistance(distanceKm) : null,
      driveMinutes: driveMin,
      walkMinutes: walkMin,
      mapLinks: mapLinks(s),
    };
  });

  // 정렬 기준: 사용자 위치 있으면 거리순, 없으면 가맹점명 가나다순(한국어 로케일).
  const byName = (a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name, 'ko-KR');
  const sorted = userPos
    ? [
        ...enriched
          .filter((s) => s.distanceKm != null)
          .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0)),
        ...enriched.filter((s) => s.distanceKm == null).sort(byName),
      ]
    : [...enriched].sort(byName);

  return NextResponse.json({
    userPosition: userPos,
    stores: sorted.slice(0, limit),
    total: rows.length,
    withCoord: enriched.filter((s) => s.hasCoord).length,
  });
}
