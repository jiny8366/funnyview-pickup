import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { inventory, inventoryMovements, lensVariants } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

async function requireStaff() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== 'warehouse_staff' && user.role !== 'admin') return null;
  return user;
}

/**
 * POST /api/warehouse/inbound
 *   body: {
 *     variantId: string,
 *     quantity:  number (팩 수, 양수),
 *     note?:     string,
 *     supplier?: string,  // 공급사 (note 에 부가 정보로 기록)
 *   }
 *
 *   결과:
 *     - inventory.quantity_on_hand += quantity
 *     - inventory_movements 에 inbound 기록
 */
export async function POST(req: Request) {
  const user = await requireStaff();
  if (!user) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const variantId = typeof body.variantId === 'string' ? body.variantId : '';
  const quantity = Number(body.quantity);
  const note = typeof body.note === 'string' ? body.note : null;

  if (!variantId || !Number.isInteger(quantity) || quantity <= 0) {
    return NextResponse.json({ error: 'INVALID_PARAMS' }, { status: 400 });
  }

  const [variant] = await db
    .select()
    .from(lensVariants)
    .where(eq(lensVariants.id, variantId))
    .limit(1);
  if (!variant) {
    return NextResponse.json({ error: 'VARIANT_NOT_FOUND' }, { status: 404 });
  }

  // upsert inventory
  await db
    .insert(inventory)
    .values({
      variantId,
      quantityOnHand: quantity,
    })
    .onConflictDoUpdate({
      target: inventory.variantId,
      set: {
        quantityOnHand: sql`${inventory.quantityOnHand} + ${quantity}`,
        updatedAt: new Date(),
      },
    });

  const [invRow] = await db
    .select()
    .from(inventory)
    .where(eq(inventory.variantId, variantId))
    .limit(1);

  // 이동 기록 (append-only audit log)
  const [movement] = await db
    .insert(inventoryMovements)
    .values({
      variantId,
      movementType: 'inbound',
      quantity, // 양수 (입고)
      referenceType: 'inbound',
      note,
      performedBy: user.id,
    })
    .returning();

  return NextResponse.json({
    ok: true,
    inventory: invRow,
    movement,
  });
}
