import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { lenses } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return null;
  return user;
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const [row] = await db.select().from(lenses).where(eq(lenses.id, params.id)).limit(1);
  if (!row) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ lens: row });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const allowed: Record<string, unknown> = {};
  const fields = [
    'productCode',
    'brand',
    'name',
    'lensType',
    'replacementCycle',
    'piecesPerBox',
    'price',
    'cost',
    'imageUrl',
    'description',
    'baseCurve',
    'diameter',
    'waterContent',
    'material',
    'sphereMin',
    'sphereMax',
    'mfdsPermitNo',
    'mfdsClassificationCode',
    'mfdsProductName',
    'manufacturer',
    'isActive',
  ] as const;

  for (const k of fields) {
    if (k in body) {
      const v = body[k];
      if (k === 'price' || k === 'cost' || k === 'piecesPerBox') {
        allowed[k] = v == null ? null : Number(v);
      } else if (['baseCurve', 'diameter', 'waterContent', 'sphereMin', 'sphereMax'].includes(k)) {
        allowed[k] = v == null || v === '' ? null : String(v);
      } else {
        allowed[k] = v;
      }
    }
  }
  allowed.updatedAt = new Date();

  const [row] = await db
    .update(lenses)
    .set(allowed)
    .where(eq(lenses.id, params.id))
    .returning();

  if (!row) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ lens: row });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  await db
    .update(lenses)
    .set({ deletedAt: new Date(), isActive: false })
    .where(eq(lenses.id, params.id));

  return NextResponse.json({ ok: true });
}
