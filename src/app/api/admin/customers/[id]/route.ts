import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { customers } from '@/db/schema';
import { requirePermissionForApi } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  name: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(1).optional(),
  gender: z.enum(['male', 'female', 'other']).nullable().optional(),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  postalCode: z.string().nullable().optional(),
  addressLine1: z.string().nullable().optional(),
  addressLine2: z.string().nullable().optional(),
  landlinePhone: z.string().nullable().optional(),
  memberType: z.enum(['individual', 'business']).optional(),
  adminMemo: z.string().nullable().optional(),
});

/**
 * 고객 정보 수정 (admin 전용). customers_write 권한 필요.
 * 빈 문자열은 NULL 로 정규화하여 저장.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const me = await requirePermissionForApi('customers_write');
  if (!me) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다.' }, { status: 400 });
  }

  const d = parsed.data;
  const emptyToNull = (v: string | null | undefined) =>
    v === undefined ? undefined : v === '' ? null : v;

  const updates = {
    ...(d.name !== undefined ? { name: d.name } : {}),
    ...(d.phone !== undefined ? { phone: d.phone } : {}),
    ...(d.gender !== undefined ? { gender: d.gender } : {}),
    ...(d.birthDate !== undefined ? { birthDate: d.birthDate } : {}),
    ...(d.memberType !== undefined ? { memberType: d.memberType } : {}),
    postalCode: emptyToNull(d.postalCode),
    addressLine1: emptyToNull(d.addressLine1),
    addressLine2: emptyToNull(d.addressLine2),
    landlinePhone: emptyToNull(d.landlinePhone),
    adminMemo: emptyToNull(d.adminMemo),
    updatedAt: new Date(),
  };
  // emptyToNull 이 undefined 를 반환한 키는 set 에서 제거 (변경 안 함)
  for (const k of Object.keys(updates) as (keyof typeof updates)[]) {
    if (updates[k] === undefined) delete updates[k];
  }

  const [updated] = await db
    .update(customers)
    .set(updates)
    .where(eq(customers.id, params.id))
    .returning({ id: customers.id });

  if (!updated) {
    return NextResponse.json({ error: '고객을 찾을 수 없습니다.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
