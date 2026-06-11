import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { getStoreCatalog } from '@/lib/pricing/store-supply-price';

export const dynamic = 'force-dynamic';

/**
 * GET /api/store/catalog
 * 로그인한 가맹점(store_staff)의 발주용 제품 카탈로그.
 * 각 제품에 해석된 **공급가(supply price)** 포함. 소비자 retail 가격은 절대 미포함.
 * 대표자(owner) · 안경사(optician) 모두 허용. me.storeId 로 스코프 고정.
 */
export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'store_staff' || !me.storeId) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  try {
    const items = await getStoreCatalog(me.storeId);
    return NextResponse.json({ items });
  } catch (err) {
    console.error('[api/store/catalog] 조회 실패:', err);
    return NextResponse.json({ items: [], degraded: true });
  }
}
