import { NextResponse } from 'next/server';
import { and, eq, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { customers, users } from '@/db/schema';
import { hashPassword } from '@/lib/auth/password';
import { setSessionCookie } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

// 비밀번호 정책: 8-16자, 영문 대소문자/숫자/특수문자 중 3가지 이상 조합
function isStrongPassword(pw: string): boolean {
  if (pw.length < 8 || pw.length > 16) return false;
  const checks = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/];
  const matched = checks.filter((re) => re.test(pw)).length;
  return matched >= 3;
}

const registerSchema = z.object({
  email: z.string().email('이메일 형식이 올바르지 않습니다'),
  username: z
    .string()
    .regex(/^[a-z0-9]{4,16}$/, '영문 소문자/숫자 4-16자 입력해주세요'),
  password: z
    .string()
    .min(8)
    .max(16)
    .refine(isStrongPassword, '영문 대소문자/숫자/특수문자 중 3가지 이상 조합'),
  passwordConfirm: z.string(),
  name: z.string().min(2).max(30),
  phone: z
    .string()
    .regex(/^01[016789]\d{7,8}$/, '휴대전화번호 형식이 올바르지 않습니다'),
  landlinePhone: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  addressLine1: z.string().optional().nullable(),
  addressLine2: z.string().optional().nullable(),
  memberType: z.enum(['online', 'offline']).default('online'),
  referredByCode: z.string().optional().nullable(),
  refundBank: z
    .object({
      holder: z.string().optional(),
      bank: z.string().optional(),
      account: z.string().optional(),
    })
    .optional()
    .nullable(),
});

export async function POST(req: Request) {
  const parsed = registerSchema.safeParse(await req.json().catch(() => ({})));
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

  // phone / username / email 중복 검사
  const existing = await db
    .select({ id: users.id, phone: users.phone, username: users.username, email: users.email })
    .from(users)
    .where(
      and(
        or(
          eq(users.phone, input.phone),
          eq(users.username, input.username),
          eq(users.email, input.email),
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
    if (e.username === input.username) {
      return NextResponse.json({ error: 'USERNAME_TAKEN' }, { status: 409 });
    }
    if (e.email === input.email) {
      return NextResponse.json({ error: 'EMAIL_TAKEN' }, { status: 409 });
    }
  }

  let referrerId: string | null = null;
  if (input.referredByCode) {
    const ref = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.referrerCode, input.referredByCode))
      .limit(1);
    referrerId = ref[0]?.id ?? null;
  }

  const passwordHash = await hashPassword(input.password);

  const created = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        username: input.username,
        email: input.email,
        phone: input.phone,
        passwordHash,
        role: 'customer',
      })
      .returning({ id: users.id });

    const [customer] = await tx
      .insert(customers)
      .values({
        userId: user.id,
        name: input.name,
        phone: input.phone,
        landlinePhone: input.landlinePhone ?? null,
        postalCode: input.postalCode ?? null,
        addressLine1: input.addressLine1 ?? null,
        addressLine2: input.addressLine2 ?? null,
        memberType: input.memberType,
        refundBank: input.refundBank ?? null,
        referredByCode: input.referredByCode ?? null,
        referredById: referrerId,
        referrerCode: 'FV' + user.id.replace(/-/g, '').slice(0, 8).toUpperCase(),
      })
      .returning({ id: customers.id });

    return { userId: user.id, customerId: customer.id };
  });

  await setSessionCookie({ uid: created.userId, role: 'customer' });

  return NextResponse.json({
    ok: true,
    userId: created.userId,
    customerId: created.customerId,
  });
}
