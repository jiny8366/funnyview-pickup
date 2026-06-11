import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { suppliers } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/suppliers?all=1
 *   - 기본: 활성 매입처만 (드롭다운용)
 *   - all=1: 비활성 포함 (어드민 관리 화면용)
 *   admin 전용.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const url = new URL(req.url);
  const includeAll = url.searchParams.get('all') === '1';

  const rows = includeAll
    ? await db.select().from(suppliers).orderBy(asc(suppliers.name))
    : await db
        .select()
        .from(suppliers)
        .where(eq(suppliers.isActive, true))
        .orderBy(asc(suppliers.name));

  return NextResponse.json({ suppliers: rows });
}

/**
 * POST /api/admin/suppliers — 매입처 생성. admin 전용.
 *   body: { name(필수), bizNo?, postalCode?, address?, addressDetail?, contact?, phone?, memo? }
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json(
      { error: 'INVALID_PARAMS', detail: '매입처명은 필수입니다' },
      { status: 400 },
    );
  }

  const str = (k: string) => {
    const v = typeof body[k] === 'string' ? (body[k] as string).trim() : '';
    return v === '' ? null : v;
  };

  const [row] = await db
    .insert(suppliers)
    .values({
      name,
      bizNo: str('bizNo'),
      postalCode: str('postalCode'),
      address: str('address'),
      addressDetail: str('addressDetail'),
      contact: str('contact'),
      phone: str('phone'),
      memo: str('memo'),
    })
    .returning();

  return NextResponse.json({ ok: true, supplier: row });
}
