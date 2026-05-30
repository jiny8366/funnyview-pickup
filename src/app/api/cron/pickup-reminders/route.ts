/**
 * 픽업 재독촉 cron — 매일 1회 실행 (vercel.json 의 crons 설정).
 * ready 상태 주문 중 마지막 알림(또는 readyAt) 후 REMINDER_INTERVAL_DAYS 일이 지나면
 * 고객에게 재독촉 알림을 보내고 lastReminderAt 을 갱신한다.
 * 매장이 미수령/반품으로 상태를 바꾸면 status 가 ready 가 아니어서 자동 중단된다.
 */
import { NextResponse } from 'next/server';
import { and, eq, isNull, lt, or } from 'drizzle-orm';
import { db } from '@/db/client';
import { customers, orders, stores } from '@/db/schema';
import { dispatchNotification } from '@/lib/notifications/dispatcher';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const REMINDER_INTERVAL_DAYS = 2;

export async function GET(req: Request) {
  // Vercel Cron 은 Authorization: Bearer ${CRON_SECRET} 헤더를 자동으로 첨부.
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - REMINDER_INTERVAL_DAYS * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      customerUserId: customers.userId,
      customerPhone: customers.phone,
      customerName: customers.name,
      storeName: stores.name,
      storeAddress: stores.addressLine1,
    })
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .innerJoin(stores, eq(stores.id, orders.pickupStoreId))
    .where(
      and(
        eq(orders.status, 'ready'),
        or(
          and(isNull(orders.lastReminderAt), lt(orders.readyAt, cutoff)),
          lt(orders.lastReminderAt, cutoff),
        ),
      ),
    );

  let sent = 0;
  const failed: string[] = [];
  for (const r of rows) {
    try {
      await dispatchNotification({
        kind: 'pickup_reminder',
        recipients: [
          { userId: r.customerUserId, phone: r.customerPhone, preferKakao: true },
        ],
        context: {
          orderNumber: r.orderNumber,
          customerName: r.customerName,
          storeName: r.storeName,
          storeAddress: r.storeAddress ?? undefined,
        },
        referenceType: 'order',
        referenceId: r.id,
      });
      await db.update(orders).set({ lastReminderAt: now }).where(eq(orders.id, r.id));
      sent++;
    } catch (e) {
      failed.push(`${r.orderNumber}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json({ checked: rows.length, sent, failed });
}
