import { NextResponse } from 'next/server';
import { and, eq, isNull, ne, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { stores, users } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { hashPassword } from '@/lib/auth/password';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return null;
  return user;
}

function isStrongPassword(pw: string): boolean {
  if (pw.length < 8 || pw.length > 16) return false;
  const checks = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/];
  return checks.filter((re) => re.test(pw)).length >= 3;
}

const updateSchema = z.object({
  role: z.enum(['admin', 'warehouse_staff', 'store_staff']),
  email: z.string().email('이메일 형식이 올바르지 않습니다'),
  phone: z
    .string()
    .regex(/^01[016789]\d{7,8}$/, '휴대전화 형식이 올바르지 않습니다'),
  password: z
    .string()
    .refine(
      (pw) => pw === '' || isStrongPassword(pw),
      '비밀번호는 8-16자, 영문 대소문자/숫자/특수문자 중 3가지 이상 조합',
    )
    .optional(),
  passwordConfirm: z.string().optional(),
  storeId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().default(true),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const me = await requireAdmin();
  if (!me) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const targetId = params.id;
  const isSelf = me.id === targetId;

  const parsed = updateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_INPUT', detail: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // 비밀번호 확인 일치
  if (input.password && input.password !== input.passwordConfirm) {
    return NextResponse.json({ error: 'PASSWORD_MISMATCH' }, { status: 400 });
  }

  // 대상 사용자 조회
  const [target] = await db
    .select({ id: users.id, role: users.role, isActive: users.isActive })
    .from(users)
    .where(and(eq(users.id, targetId), isNull(users.deletedAt)))
    .limit(1);
  if (!target) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  // 본인 보호: role/isActive 변경 금지
  if (isSelf) {
    if (input.role !== target.role) {
      return NextResponse.json({ error: 'CANNOT_MODIFY_SELF_ROLE' }, { status: 400 });
    }
    if (input.isActive === false) {
      return NextResponse.json({ error: 'CANNOT_DEACTIVATE_SELF' }, { status: 400 });
    }
  }

  // role/storeId 정합성
  if (input.role === 'store_staff' && !input.storeId) {
    return NextResponse.json({ error: 'STORE_ID_REQUIRED' }, { status: 400 });
  }
  if (input.role !== 'store_staff' && input.storeId) {
    return NextResponse.json({ error: 'STORE_ID_NOT_ALLOWED' }, { status: 400 });
  }
  if (input.role === 'store_staff' && input.storeId) {
    const s = await db
      .select({ id: stores.id })
      .from(stores)
      .where(eq(stores.id, input.storeId))
      .limit(1);
    if (!s[0]) {
      return NextResponse.json({ error: 'STORE_NOT_FOUND' }, { status: 400 });
    }
  }

  // email / phone 중복 (자기 자신 제외)
  const conflict = await db
    .select({ id: users.id, phone: users.phone, email: users.email })
    .from(users)
    .where(
      and(
        ne(users.id, targetId),
        or(
          eq(users.phone, input.phone),
          eq(users.email, input.email),
          eq(users.username, input.email),
        ),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);
  if (conflict[0]) {
    if (conflict[0].phone === input.phone) {
      return NextResponse.json({ error: 'PHONE_TAKEN' }, { status: 409 });
    }
    return NextResponse.json({ error: 'EMAIL_TAKEN' }, { status: 409 });
  }

  const updates: Record<string, unknown> = {
    role: input.role,
    email: input.email,
    username: input.email,
    phone: input.phone,
    storeId: input.role === 'store_staff' ? input.storeId ?? null : null,
    isActive: input.isActive,
  };
  if (input.password) {
    updates.passwordHash = await hashPassword(input.password);
  }

  await db.update(users).set(updates).where(eq(users.id, targetId));

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const me = await requireAdmin();
  if (!me) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const targetId = params.id;
  if (me.id === targetId) {
    return NextResponse.json({ error: 'CANNOT_DEACTIVATE_SELF' }, { status: 400 });
  }

  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, targetId), isNull(users.deletedAt)))
    .limit(1);
  if (!target) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  await db
    .update(users)
    .set({ deletedAt: new Date(), isActive: false })
    .where(eq(users.id, targetId));

  return NextResponse.json({ ok: true });
}
