import { NextResponse } from 'next/server';
import { and, eq, isNull, or } from 'drizzle-orm';
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

const createSchema = z.object({
  role: z.enum(['admin', 'warehouse_staff', 'store_staff']),
  email: z.string().email('이메일 형식이 올바르지 않습니다'),
  phone: z
    .string()
    .regex(/^01[016789]\d{7,8}$/, '휴대전화 형식이 올바르지 않습니다'),
  password: z
    .string()
    .refine(
      isStrongPassword,
      '비밀번호는 8-16자, 영문 대소문자/숫자/특수문자 중 3가지 이상 조합',
    ),
  passwordConfirm: z.string(),
  storeId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().default(true),
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

  if (input.password !== input.passwordConfirm) {
    return NextResponse.json({ error: 'PASSWORD_MISMATCH' }, { status: 400 });
  }
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

  const existing = await db
    .select({ id: users.id, phone: users.phone, email: users.email, username: users.username })
    .from(users)
    .where(
      and(
        or(
          eq(users.phone, input.phone),
          eq(users.email, input.email),
          eq(users.username, input.email),
        ),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  if (existing[0]) {
    const e = existing[0];
    if (e.phone === input.phone) {
      return NextResponse.json({ error: 'PHONE_TAKEN' }, { status: 409 });
    }
    return NextResponse.json({ error: 'EMAIL_TAKEN' }, { status: 409 });
  }

  const passwordHash = await hashPassword(input.password);

  const [created] = await db
    .insert(users)
    .values({
      username: input.email,
      email: input.email,
      phone: input.phone,
      passwordHash,
      role: input.role,
      storeId: input.role === 'store_staff' ? input.storeId ?? null : null,
      isActive: input.isActive,
    })
    .returning({ id: users.id });

  return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
}
