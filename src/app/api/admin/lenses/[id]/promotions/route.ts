import { NextResponse } from 'next/server';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
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

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  if (!me.isMaster && !hasPermission(me.permissions, 'products_read')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const rows = await db
    .select({
      id: lensPromotions.id,
      kind: lensPromotions.kind,
      discountAmount: lensPromotions.discountAmount,
      discountPercent: lensPromotions.discountPercent,
      storeTier: lensPromotions.storeTier,
      buyQty: lensPromotions.buyQty,
      freeQty: lensPromotions.freeQty,
      startsAt: lensPromotions.startsAt,
      endsAt: lensPromotions.endsAt,
      isActive: lensPromotions.isActive,
      note: lensPromotions.note,
      createdAt: lensPromotions.createdAt,
    })
    .from(lensPromotions)
    .where(and(eq(lensPromotions.lensId, params.id), isNull(lensPromotions.deletedAt)))
    .orderBy(desc(lensPromotions.createdAt));

  return NextResponse.json({ promotions: rows });
}

const createSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('sale'),
    discountAmount: z.number().min(0).optional().default(0),
    discountPercent: z.number().min(0).max(100).optional().default(0),
    storeTier: z.string().max(50).optional().nullable(),
    startsAt: z.string().optional().nullable(),
    endsAt: z.string().optional().nullable(),
    note: z.string().optional().nullable(),
  }),
  z.object({
    kind: z.literal('promotion'),
    discountAmount: z.number().min(0).optional().default(0),
    discountPercent: z.number().min(0).max(100).optional().default(0),
    startsAt: z.string().optional().nullable(),
    endsAt: z.string().optional().nullable(),
    note: z.string().optional().nullable(),
  }),
  z.object({
    kind: z.literal('volume_bundle'),
    buyQty: z.number().int().min(1),
    freeQty: z.number().int().min(1),
    startsAt: z.string().optional().nullable(),
    endsAt: z.string().optional().nullable(),
    note: z.string().optional().nullable(),
  }),
]);

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const me = await requireProductsWrite();
  if (!me) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_INPUT', detail: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  if (input.startsAt && input.endsAt) {
    if (new Date(input.startsAt) > new Date(input.endsAt)) {
      return NextResponse.json({ error: 'INVALID_DATE_RANGE' }, { status: 400 });
    }
  }

  const values = {
    lensId: params.id,
    kind: input.kind,
    discountAmount: 'discountAmount' in input ? input.discountAmount : 0,
    discountPercent: 'discountPercent' in input ? input.discountPercent : 0,
    storeTier: 'storeTier' in input ? input.storeTier ?? null : null,
    buyQty: 'buyQty' in input ? input.buyQty : null,
    freeQty: 'freeQty' in input ? input.freeQty : null,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
    note: input.note ?? null,
  };

  const [created] = await db.insert(lensPromotions).values(values).returning();
  return NextResponse.json({ ok: true, promotion: created }, { status: 201 });
}
