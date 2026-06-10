import { NextResponse } from 'next/server';
import { and, eq, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { customers, users } from '@/db/schema';
import { hashPassword } from '@/lib/auth/password';
import { withDbRetry } from '@/lib/db/retry';
import { checkRateLimit, clientIp } from '@/lib/security/rate-limit';

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
  password: z
    .string()
    .min(8)
    .max(16)
    .refine(isStrongPassword, '영문 대소문자/숫자/특수문자 중 3가지 이상 조합'),
  passwordConfirm: z.string(),
  name: z.string().min(2).max(30),
  gender: z.enum(['male', 'female', 'other'], { errorMap: () => ({ message: '성별을 선택해주세요' }) }),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '생년월일 형식이 올바르지 않습니다'), // 구매 연령제한 판단용
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
  // 자동 가입(봇) 방어: IP 당 5회/10분 (go-live 보안)
  const rl = checkRateLimit(`register:ip:${clientIp(req)}`, 5, 600_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'TOO_MANY_ATTEMPTS', message: `가입 시도가 너무 많습니다. ${rl.retryAfterSec}초 후 다시 시도해주세요.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    );
  }

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

  // phone / email 중복 검사 (이메일이 로그인 ID)
  const existing = await withDbRetry(() =>
    db
      .select({ id: users.id, phone: users.phone, email: users.email })
      .from(users)
      .where(
        and(
          or(eq(users.phone, input.phone), eq(users.email, input.email)),
          isNull(users.deletedAt),
        ),
      )
      .limit(1),
  );

  if (existing[0]) {
    const e = existing[0];
    if (e.email === input.email) {
      return NextResponse.json({ error: 'EMAIL_TAKEN' }, { status: 409 });
    }
    if (e.phone === input.phone) {
      return NextResponse.json({ error: 'PHONE_TAKEN' }, { status: 409 });
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

  // 트랜잭션은 원자적(실패 시 롤백)이라 연결 블립에 한해 재시도 안전.
  // 제약 위반(중복 등)은 비전이 오류라 withDbRetry 가 재시도하지 않고 즉시 throw.
  const created = await withDbRetry(() =>
    db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        email: input.email, // 이메일이 로그인 ID (username 컬럼은 미사용)
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
        gender: input.gender,
        birthDate: input.birthDate,
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
    }),
  );

  // 가입 후 자동 로그인하지 않음 — 가입한 정보로 직접 로그인 (JINY 지시, 일반 관행)
  return NextResponse.json({
    ok: true,
    userId: created.userId,
    customerId: created.customerId,
  });
}
