import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { geocodeAddress } from '@/lib/geo/kakao';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/geocode
 *   body: { address: string }
 *   res:  { latitude, longitude, roadAddress?, jibunAddress?, postalCode? } | { error }
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const address = typeof body.address === 'string' ? body.address : '';
  if (!address) {
    return NextResponse.json({ error: 'EMPTY_ADDRESS' }, { status: 400 });
  }
  const geo = await geocodeAddress(address);
  if (!geo) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }
  return NextResponse.json(geo);
}
