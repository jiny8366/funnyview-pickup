import { NextResponse } from 'next/server';
import { asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { stores } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

interface CreateBody {
  code?: string; // 비어있으면 자동 생성
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  postalCode?: string;
  latitude?: string | number;
  longitude?: string | number;
  businessNumber?: string;
  representativeName?: string;
  representativePhone?: string;
  commissionRate?: string | number;
  sortOrder?: number;
}

function isAdmin(user: { role: string; isMaster: boolean; permissions: string[] }) {
  return user.role === 'admin' || user.isMaster || user.permissions.includes('stores_write');
}

/**
 * GET /api/admin/stores — 가맹점 목록 (그룹 배정 UI 용). admin 전용.
 *   삭제되지 않은 매장만, name ASC.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'admin only' }, { status: 403 });
  }

  const rows = await db
    .select({
      id: stores.id,
      code: stores.code,
      name: stores.name,
      commissionRate: stores.commissionRate,
      groupId: stores.groupId,
      isActive: stores.isActive,
    })
    .from(stores)
    .where(isNull(stores.deletedAt))
    .orderBy(asc(stores.name));

  return NextResponse.json({ stores: rows });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'admin only' }, { status: 403 });
  }

  let body: CreateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  if (!body.name?.trim() || !body.phone?.trim() || !body.addressLine1?.trim()) {
    return NextResponse.json(
      { error: 'name, phone, addressLine1 required' },
      { status: 400 },
    );
  }

  // 코드 자동 생성 — 가장 큰 번호 + 1
  let code = body.code?.trim();
  if (!code) {
    const [{ next }] = await db
      .select({
        next: sql<number>`COALESCE(MAX(CAST(SUBSTRING(${stores.code} FROM 3) AS INTEGER)), 0) + 1`,
      })
      .from(stores)
      .where(sql`${stores.code} ~ '^ST-[0-9]+$'`);
    code = `ST-${String(next).padStart(4, '0')}`;
  }

  // 중복 체크
  const existing = await db
    .select({ id: stores.id })
    .from(stores)
    .where(eq(stores.code, code))
    .limit(1);
  if (existing[0]) {
    return NextResponse.json(
      { error: `code ${code} already exists` },
      { status: 409 },
    );
  }

  const [created] = await db
    .insert(stores)
    .values({
      code,
      name: body.name.trim(),
      phone: body.phone.trim(),
      addressLine1: body.addressLine1.trim(),
      addressLine2: body.addressLine2?.trim() || null,
      postalCode: body.postalCode?.trim() || null,
      latitude: body.latitude ? String(body.latitude) : null,
      longitude: body.longitude ? String(body.longitude) : null,
      businessNumber: body.businessNumber?.trim() || null,
      representativeName: body.representativeName?.trim() || null,
      representativePhone: body.representativePhone?.trim() || null,
      commissionRate: body.commissionRate ? String(body.commissionRate) : '0',
      sortOrder: body.sortOrder ?? 0,
    })
    .returning({ id: stores.id, code: stores.code });

  return NextResponse.json({ store: created }, { status: 201 });
}

/**
 * PATCH /api/admin/stores — 그룹 일괄 배정/해제. admin 전용.
 *   body: { storeIds: string[], groupId: string | null }
 *   groupId 가 null 이면 해당 매장들의 그룹을 해제.
 */
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'admin only' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    storeIds?: unknown;
    groupId?: unknown;
  };

  const storeIds = Array.isArray(body.storeIds)
    ? body.storeIds.filter((x): x is string => typeof x === 'string')
    : [];
  if (storeIds.length === 0) {
    return NextResponse.json({ error: 'storeIds required' }, { status: 400 });
  }

  const groupId =
    typeof body.groupId === 'string' && body.groupId.trim() !== ''
      ? body.groupId.trim()
      : null;

  await db
    .update(stores)
    .set({ groupId, updatedAt: new Date() })
    .where(inArray(stores.id, storeIds));

  return NextResponse.json({ ok: true, updated: storeIds.length, groupId });
}
