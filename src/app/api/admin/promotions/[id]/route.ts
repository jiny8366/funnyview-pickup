import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { lensPromotions } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { hasPermission } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

async function requireProductsWrite() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!user.isMaster && !hasPermission(user.permissions, 'products_write')) {
    return null;
  }
  return user;
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const me = await requireProductsWrite();
  if (!me) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if ('isActive' in body) updates.isActive = !!body.isActive;
  if ('note' in body) updates.note = body.note ?? null;
  if ('startsAt' in body) updates.startsAt = body.startsAt ? new Date(body.startsAt) : null;
  if ('endsAt' in body) updates.endsAt = body.endsAt ? new Date(body.endsAt) : null;

  await db.update(lensPromotions).set(updates).where(eq(lensPromotions.id, params.id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const me = await requireProductsWrite();
  if (!me) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  await db
    .update(lensPromotions)
    .set({ deletedAt: new Date(), isActive: false })
    .where(eq(lensPromotions.id, params.id));

  return NextResponse.json({ ok: true });
}
