import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { suppliers } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/admin/suppliers/[id] — 매입처 수정. admin 전용.
 *   body: { name?, bizNo?, postalCode?, address?, addressDetail?, contact?, phone?, memo?, isActive? }
 */
export async function PUT(
  req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Partial<typeof suppliers.$inferInsert> = {};

  if ('name' in body && typeof body.name === 'string') {
    const v = body.name.trim();
    if (v) patch.name = v;
  }
  const NULLABLE: { key: keyof typeof suppliers.$inferInsert; field: string }[] = [
    { key: 'bizNo', field: 'bizNo' },
    { key: 'postalCode', field: 'postalCode' },
    { key: 'address', field: 'address' },
    { key: 'addressDetail', field: 'addressDetail' },
    { key: 'contact', field: 'contact' },
    { key: 'phone', field: 'phone' },
    { key: 'memo', field: 'memo' },
  ];
  for (const { key, field } of NULLABLE) {
    if (field in body) {
      const v = typeof body[field] === 'string' ? (body[field] as string).trim() : '';
      (patch as Record<string, unknown>)[key] = v === '' ? null : v;
    }
  }
  if ('isActive' in body && typeof body.isActive === 'boolean') {
    patch.isActive = body.isActive;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'NO_FIELDS' }, { status: 400 });
  }

  const [row] = await db
    .update(suppliers)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(suppliers.id, params.id))
    .returning();

  if (!row) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, supplier: row });
}

/**
 * DELETE /api/admin/suppliers/[id] — 소프트 비활성화 (isActive=false). admin 전용.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const [row] = await db
    .update(suppliers)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(suppliers.id, params.id))
    .returning();

  if (!row) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, supplier: row });
}
