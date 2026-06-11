import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { storeGroups, stores } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

function isAdmin(user: { role: string; isMaster: boolean; permissions: string[] }) {
  return user.role === 'admin' || user.isMaster || user.permissions.includes('stores_write');
}

/**
 * GET /api/admin/stores/[id] — 단일 매장 상세 (그룹명 포함). admin 전용.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'admin only' }, { status: 403 });
  }

  const [row] = await db
    .select({
      id: stores.id,
      code: stores.code,
      name: stores.name,
      phone: stores.phone,
      postalCode: stores.postalCode,
      addressLine1: stores.addressLine1,
      addressLine2: stores.addressLine2,
      latitude: stores.latitude,
      longitude: stores.longitude,
      businessNumber: stores.businessNumber,
      representativeName: stores.representativeName,
      representativePhone: stores.representativePhone,
      commissionRate: stores.commissionRate,
      groupId: stores.groupId,
      sortOrder: stores.sortOrder,
      isActive: stores.isActive,
      groupName: storeGroups.name,
      groupCommissionRate: storeGroups.commissionRate,
    })
    .from(stores)
    .leftJoin(storeGroups, eq(storeGroups.id, stores.groupId))
    .where(eq(stores.id, params.id))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json({ store: row });
}

/**
 * PUT /api/admin/stores/[id] — 매장 수정. admin 전용.
 *   편집 가능: name, phone, addressLine1/2, postalCode, latitude, longitude,
 *   businessNumber, representativeName, representativePhone, commissionRate,
 *   sortOrder, groupId, isActive. (code 는 변경 불가)
 */
export async function PUT(
  req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'admin only' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Partial<typeof stores.$inferInsert> = {};

  // 문자열 필드
  const strFields: Array<keyof typeof stores.$inferInsert> = [
    'name',
    'phone',
    'addressLine1',
  ];
  for (const f of strFields) {
    if (f in body && typeof body[f] === 'string') {
      const v = (body[f] as string).trim();
      if (v) (patch as Record<string, unknown>)[f] = v;
    }
  }

  // nullable 문자열 필드
  const nullableStr: Array<keyof typeof stores.$inferInsert> = [
    'addressLine2',
    'postalCode',
    'businessNumber',
    'representativeName',
    'representativePhone',
  ];
  for (const f of nullableStr) {
    if (f in body) {
      const v = typeof body[f] === 'string' ? (body[f] as string).trim() : '';
      (patch as Record<string, unknown>)[f] = v === '' ? null : v;
    }
  }

  // 좌표 (numeric → 문자열 저장, 빈 값이면 null)
  for (const f of ['latitude', 'longitude'] as const) {
    if (f in body) {
      const raw = body[f];
      patch[f] = raw == null || raw === '' ? null : String(raw);
    }
  }

  if ('commissionRate' in body && body.commissionRate != null && body.commissionRate !== '') {
    patch.commissionRate = String(body.commissionRate);
  }

  if ('sortOrder' in body) {
    const n = typeof body.sortOrder === 'number' ? body.sortOrder : Number(body.sortOrder);
    if (!Number.isNaN(n)) patch.sortOrder = n;
  }

  if ('groupId' in body) {
    patch.groupId =
      typeof body.groupId === 'string' && body.groupId.trim() !== ''
        ? body.groupId.trim()
        : null;
  }

  if ('isActive' in body) {
    patch.isActive = Boolean(body.isActive);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'NO_FIELDS' }, { status: 400 });
  }

  const [row] = await db
    .update(stores)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(stores.id, params.id))
    .returning({ id: stores.id });

  if (!row) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, store: row });
}
