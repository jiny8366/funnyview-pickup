import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { notifications, orders } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

/**
 * 주문별 고객 알림 발송 이력 (운영화면용 — 보드 #9).
 * 가맹점/픽업업체가 "고객에게 알림이 실제 나갔는지" 확인해 클레임에 대응한다.
 * 권한: admin·warehouse_staff = 전체, store_staff = 자기 매장 주문만. (고객 불가)
 */
export async function GET(
  _req: Request,
  ctx: { params: { id: string } },
) {
  const me = await getCurrentUser();
  if (!me || me.role === 'customer') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const orderId = ctx.params.id;

  if (me.role === 'store_staff') {
    const ord = await db
      .select({ pickupStoreId: orders.pickupStoreId })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    if (!ord[0] || ord[0].pickupStoreId !== me.storeId) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
  }

  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.notificationType,
      channel: notifications.channel,
      status: notifications.status,
      title: notifications.title,
      sentAt: notifications.sentAt,
      failedReason: notifications.failedReason,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(
      and(
        eq(notifications.referenceType, 'order'),
        eq(notifications.referenceId, orderId),
      ),
    )
    .orderBy(desc(notifications.createdAt));

  return NextResponse.json({ notifications: rows });
}
