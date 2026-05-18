import { NextResponse } from 'next/server';
import { geocodeAddress } from '@/lib/geo/kakao';

export const dynamic = 'force-dynamic';

/**
 * POST /api/stores/geocode-customer
 *   body: { address: string }
 *   res:  { latitude, longitude } | { error }
 *
 * 고객용 — 비로그인 접근 허용 (매장찾기 페이지).
 * 응답에 도로명/지번/우편번호 등 부가 정보는 노출 안 함 (남용 방지).
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const address = typeof body.address === 'string' ? body.address.trim() : '';
  if (!address || address.length < 3) {
    return NextResponse.json({ error: 'INVALID_ADDRESS' }, { status: 400 });
  }
  const geo = await geocodeAddress(address);
  if (!geo) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }
  return NextResponse.json({
    latitude: geo.latitude,
    longitude: geo.longitude,
  });
}
