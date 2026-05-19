import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { hasPermission } from '@/lib/auth/permissions';
import { fetchPriceHistory } from '@/lib/price-history';
import type { PriceScope } from '@/db/schema';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  if (!me.isMaster && !hasPermission(me.permissions, 'price_history_view')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') ?? 100);
  const offset = Number(url.searchParams.get('offset') ?? 0);
  const lensId = url.searchParams.get('lensId') ?? undefined;
  const scope = (url.searchParams.get('scope') as PriceScope | null) ?? undefined;

  const rows = await fetchPriceHistory({ limit, offset, lensId, scope });
  return NextResponse.json({ rows });
}
