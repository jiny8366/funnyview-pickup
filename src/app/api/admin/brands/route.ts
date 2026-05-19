import { NextResponse } from 'next/server';
import { and, asc, eq, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { brands } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return null;
  return user;
}

export async function GET() {
  const me = await requireAdmin();
  if (!me) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const rows = await db
    .select({
      id: brands.id,
      nameKo: brands.nameKo,
      nameEn: brands.nameEn,
      code: brands.code,
      isActive: brands.isActive,
    })
    .from(brands)
    .where(isNull(brands.deletedAt))
    .orderBy(asc(brands.nameKo));

  return NextResponse.json({ brands: rows });
}

const createSchema = z.object({
  nameKo: z.string().min(1, '국문명을 입력하세요').max(50),
  nameEn: z.string().min(1, '영문명을 입력하세요').max(50),
  code: z
    .string()
    .regex(/^[A-Z]{3}$/, '영문 대문자 3자로 입력하세요 (예: CHR)'),
});

export async function POST(req: Request) {
  const me = await requireAdmin();
  if (!me) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_INPUT', detail: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const existing = await db
    .select({ id: brands.id, nameKo: brands.nameKo, code: brands.code })
    .from(brands)
    .where(
      and(
        or(eq(brands.nameKo, input.nameKo), eq(brands.code, input.code)),
        isNull(brands.deletedAt),
      ),
    )
    .limit(1);

  if (existing[0]) {
    if (existing[0].nameKo === input.nameKo) {
      return NextResponse.json({ error: 'NAME_TAKEN' }, { status: 409 });
    }
    return NextResponse.json({ error: 'CODE_TAKEN' }, { status: 409 });
  }

  const [created] = await db
    .insert(brands)
    .values({
      nameKo: input.nameKo,
      nameEn: input.nameEn,
      code: input.code,
    })
    .returning({
      id: brands.id,
      nameKo: brands.nameKo,
      nameEn: brands.nameEn,
      code: brands.code,
      isActive: brands.isActive,
    });

  return NextResponse.json({ ok: true, brand: created }, { status: 201 });
}
