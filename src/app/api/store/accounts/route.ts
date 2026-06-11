import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { hashPassword } from '@/lib/auth/password';

export const dynamic = 'force-dynamic';

const USERNAME_RE = /^[a-z0-9]{4,16}$/;

/** 가맹점 대표자(owner)만 — 자기 매장 담당 안경사 계정 관리. */
async function requireOwner() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'store_staff' || me.storeRole !== 'owner' || !me.storeId) return null;
  return me;
}

function strongPw(pw: string): boolean {
  if (pw.length < 8 || pw.length > 16) return false;
  return [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(pw)).length >= 3;
}

/** GET — 우리 매장 담당 안경사 목록. */
export async function GET() {
  const me = await requireOwner();
  if (!me) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.storeId, me.storeId!), eq(users.storeRole, 'optician'), isNull(users.deletedAt)))
    .orderBy(users.createdAt);

  return NextResponse.json({ opticians: rows });
}

const createSchema = z.object({
  username: z.string().regex(USERNAME_RE, '아이디는 영문 소문자·숫자 4~16자'),
  password: z.string().refine(strongPw, '비밀번호 8~16자·영문 대소문/숫자/특수 중 3종 이상'),
  name: z.string().min(1, '담당 안경사 이름을 입력하세요').max(40),
});

/** POST — 담당 안경사 신규 등록(자기 매장). */
export async function POST(req: Request) {
  const me = await requireOwner();
  if (!me) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT', detail: parsed.error.flatten() }, { status: 400 });
  }
  const { username, password, name } = parsed.data;

  const dup = await db.select({ id: users.id }).from(users).where(and(eq(users.username, username), isNull(users.deletedAt))).limit(1);
  if (dup[0]) return NextResponse.json({ error: 'USERNAME_TAKEN', message: '이미 사용 중인 아이디입니다' }, { status: 409 });

  const [row] = await db
    .insert(users)
    .values({
      username,
      passwordHash: await hashPassword(password),
      role: 'store_staff',
      storeId: me.storeId,
      storeRole: 'optician',
      name,
      isActive: true,
    })
    .returning({ id: users.id, username: users.username, name: users.name });
  return NextResponse.json({ optician: row });
}

const patchSchema = z.object({
  id: z.string().uuid(),
  password: z.string().refine(strongPw, '비밀번호 규칙 불충족').optional(),
  name: z.string().min(1).max(40).optional(),
  isActive: z.boolean().optional(),
});

/** PATCH — 우리 매장 안경사 비밀번호 재설정 / 활성 토글 / 이름 수정. */
export async function PATCH(req: Request) {
  const me = await requireOwner();
  if (!me) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT', detail: parsed.error.flatten() }, { status: 400 });
  }
  const { id, password, name, isActive } = parsed.data;

  // 대상이 우리 매장 소속 안경사인지 확인(타 매장/대표자 변경 차단)
  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, id), eq(users.storeId, me.storeId!), eq(users.storeRole, 'optician'), isNull(users.deletedAt)))
    .limit(1);
  if (!target) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  await db
    .update(users)
    .set({
      ...(password ? { passwordHash: await hashPassword(password) } : {}),
      ...(name !== undefined ? { name } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, id));
  return NextResponse.json({ ok: true });
}
