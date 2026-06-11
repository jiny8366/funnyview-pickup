import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { notifications } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

/** 인앱(벨) 미읽음 알림 일괄 읽음 처리 — 읽으면 벨 목록에서 사라진다. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.recipientUserId, user.id),
        eq(notifications.channel, 'app'),
        isNull(notifications.readAt),
      ),
    );

  return NextResponse.json({ ok: true });
}
