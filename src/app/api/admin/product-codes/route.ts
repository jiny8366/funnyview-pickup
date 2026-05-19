import { NextResponse } from 'next/server';
import { and, asc, eq, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { productCodes } from '@/db/schema';
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
      id: productCodes.id,
      nameKo: productCodes.nameKo,
      nameEn: productCodes.nameEn,
      code: productCodes.code,
      suffix: productCodes.suffix,
      isActive: productCodes.isActive,
    })
    .from(productCodes)
    .where(isNull(productCodes.deletedAt))
    .orderBy(asc(productCodes.nameEn));

  return NextResponse.json({ productCodes: rows });
}

const createSchema = z.object({
  nameKo: z.string().min(1, '국문명을 입력하세요').max(80),
  nameEn: z.string().min(1, '영문명을 입력하세요').max(80),
  code: z
    .string()
    .regex(/^[A-Z0-9]{3}$/, '영문 대문자/숫자 3자로 입력하세요 (예: OOL)'),
  suffix: z
    .string()
    .regex(/^[A-Z0-9]{2}$/, '영문 대문자/숫자 2자로 입력하세요 (예: 1D)'),
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
    .select({
      id: productCodes.id,
      nameKo: productCodes.nameKo,
      code: productCodes.code,
      suffix: productCodes.suffix,
    })
    .from(productCodes)
    .where(
      and(
        or(
          eq(productCodes.nameKo, input.nameKo),
          and(eq(productCodes.code, input.code), eq(productCodes.suffix, input.suffix)),
        ),
        isNull(productCodes.deletedAt),
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
    .insert(productCodes)
    .values({
      nameKo: input.nameKo,
      nameEn: input.nameEn,
      code: input.code,
      suffix: input.suffix,
    })
    .returning({
      id: productCodes.id,
      nameKo: productCodes.nameKo,
      nameEn: productCodes.nameEn,
      code: productCodes.code,
      suffix: productCodes.suffix,
      isActive: productCodes.isActive,
    });

  return NextResponse.json({ ok: true, productCode: created }, { status: 201 });
}
