import { NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { groupProductCommissions, lenses } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

function isAdmin(user: { role: string; isMaster: boolean; permissions: string[] }) {
  return user.role === 'admin' || user.isMaster || user.permissions.includes('stores_write');
}

/**
 * GET /api/admin/store-groups/[id]/product-commissions
 *   그룹의 제품별 수수료율 오버라이드 목록 (lenses 조인). admin 전용.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'admin only' }, { status: 403 });
  }

  const rows = await db
    .select({
      id: groupProductCommissions.id,
      lensId: groupProductCommissions.lensId,
      commissionRate: groupProductCommissions.commissionRate,
      supplyPrice: groupProductCommissions.supplyPrice,
      brand: lenses.brand,
      name: lenses.name,
      productCode: lenses.productCode,
      updatedAt: groupProductCommissions.updatedAt,
    })
    .from(groupProductCommissions)
    .innerJoin(lenses, eq(lenses.id, groupProductCommissions.lensId))
    .where(eq(groupProductCommissions.groupId, params.id))
    .orderBy(asc(lenses.brand), asc(lenses.name));

  return NextResponse.json({ commissions: rows });
}

/**
 * POST /api/admin/store-groups/[id]/product-commissions
 *   upsert (group_id, lens_id) → 할인율(commission_rate) + 공급가(supply_price). admin 전용.
 *
 *   body: {
 *     lensIds: string[]   // (또는 단일 lensId: string)
 *     discountRate?: number|string|null  // 가맹점 할인율(%) — commission_rate 컬럼
 *     supplyPrice?: number|string|null   // 가맹점 공급가(원)
 *   }
 *   discountRate / supplyPrice 중 최소 하나 필수. 선택한 모든 lensId 에 동일 값 일괄 적용.
 *   (그룹은 변경이력 테이블이 없으므로 history 기록은 하지 않는다.)
 *
 *   하위호환: 기존 { lensId, commissionRate } 바디도 그대로 동작한다.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'admin only' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const lensIds: string[] = Array.isArray(body.lensIds)
    ? (body.lensIds as unknown[]).filter((v): v is string => typeof v === 'string' && v.trim() !== '').map((v) => v.trim())
    : typeof body.lensId === 'string' && body.lensId.trim() !== ''
      ? [body.lensId.trim()]
      : [];
  if (lensIds.length === 0) {
    return NextResponse.json({ error: 'lensIds required' }, { status: 400 });
  }

  const rawRate = body.discountRate ?? body.commissionRate;
  const hasRate = rawRate != null && rawRate !== '';
  const rate = hasRate ? String(rawRate) : null;
  if (rate != null && Number.isNaN(Number(rate))) {
    return NextResponse.json({ error: 'discountRate invalid' }, { status: 400 });
  }

  const hasSupply = body.supplyPrice != null && body.supplyPrice !== '';
  const supplyPrice = hasSupply ? String(body.supplyPrice) : null;
  if (supplyPrice != null && Number.isNaN(Number(supplyPrice))) {
    return NextResponse.json({ error: 'supplyPrice invalid' }, { status: 400 });
  }

  if (rate == null && supplyPrice == null) {
    return NextResponse.json(
      { error: 'discountRate or supplyPrice required' },
      { status: 400 },
    );
  }

  const results = [];
  for (const lensId of lensIds) {
    const [existing] = await db
      .select({
        commissionRate: groupProductCommissions.commissionRate,
        supplyPrice: groupProductCommissions.supplyPrice,
      })
      .from(groupProductCommissions)
      .where(
        and(
          eq(groupProductCommissions.groupId, params.id),
          eq(groupProductCommissions.lensId, lensId),
        ),
      )
      .limit(1);

    const effectiveRate = rate ?? existing?.commissionRate ?? '0';
    const effectiveSupply = supplyPrice ?? existing?.supplyPrice ?? null;

    const [row] = await db
      .insert(groupProductCommissions)
      .values({ groupId: params.id, lensId, commissionRate: effectiveRate, supplyPrice: effectiveSupply })
      .onConflictDoUpdate({
        target: [groupProductCommissions.groupId, groupProductCommissions.lensId],
        set: { commissionRate: effectiveRate, supplyPrice: effectiveSupply, updatedAt: new Date() },
      })
      .returning();
    results.push(row);
  }

  return NextResponse.json({ ok: true, count: results.length, commissions: results });
}

/**
 * DELETE /api/admin/store-groups/[id]/product-commissions?lensId=...
 *   해당 그룹의 제품 오버라이드 제거. admin 전용.
 *   lensId 는 쿼리스트링 또는 body 로 전달.
 */
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'admin only' }, { status: 403 });
  }

  const url = new URL(req.url);
  let lensId = url.searchParams.get('lensId')?.trim() ?? '';
  if (!lensId) {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    lensId = typeof body.lensId === 'string' ? body.lensId.trim() : '';
  }
  if (!lensId) {
    return NextResponse.json({ error: 'lensId required' }, { status: 400 });
  }

  await db
    .delete(groupProductCommissions)
    .where(
      and(
        eq(groupProductCommissions.groupId, params.id),
        eq(groupProductCommissions.lensId, lensId),
      ),
    );

  return NextResponse.json({ ok: true });
}
