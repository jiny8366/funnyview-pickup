import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { orders, stores } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { withDbRetry } from '@/lib/db/retry';
import { prescriptionPostSchema } from '@/lib/prescription/schema';
import { listPrescriptions, savePrescription } from '@/lib/prescription/service';

export const dynamic = 'force-dynamic';

/** 픽업가맹점이 자기 매장 픽업 주문 고객의 도수만 접근하도록 검증. 통과 시 매장 정보 반환. */
async function authorizeStoreCustomer(customerId: string) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'store_staff' || !me.storeId) return null;
  const [link] = await withDbRetry(() =>
    db
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(eq(orders.customerId, customerId), eq(orders.pickupStoreId, me.storeId!)),
      )
      .limit(1),
  );
  if (!link) return null;
  const [store] = await withDbRetry(() =>
    db.select({ id: stores.id, name: stores.name }).from(stores).where(eq(stores.id, me.storeId!)).limit(1),
  );
  return store ?? null;
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const store = await authorizeStoreCustomer(params.id);
  if (!store) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  const prescriptions = await listPrescriptions(params.id);
  return NextResponse.json({ prescriptions });
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const store = await authorizeStoreCustomer(params.id);
  if (!store) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = prescriptionPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다.' }, { status: 400 });
  }
  if (!parsed.data.left && !parsed.data.right) {
    return NextResponse.json({ error: '좌/우 중 하나 이상 입력하세요.' }, { status: 400 });
  }
  // 가맹점 수정 → 상호 스냅샷 기록 (고객 마이페이지 도수이력에 '누가 수정했는지' 노출 — JINY 확정)
  await savePrescription(params.id, {
    ...parsed.data,
    changedByStore: { id: store.id, name: store.name },
  });
  return NextResponse.json({ ok: true });
}
