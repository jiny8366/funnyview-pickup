import { NextResponse } from 'next/server';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { hashPassword } from '@/lib/auth/password';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return null;
  return me;
}
function validPw(pw: string): boolean {
  return pw.length >= 6 && pw.length <= 72;
}

/** GET — 해당 매장의 대표자+안경사 계정 목록. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      name: users.name,
      storeRole: users.storeRole,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.storeId, params.id), eq(users.role, 'store_staff'), isNull(users.deletedAt)))
    .orderBy(asc(users.storeRole), asc(users.createdAt));
  return NextResponse.json({ accounts: rows });
}

const createSchema = z.object({
  storeRole: z.enum(['owner', 'optician']),
  email: z.string().email('아이디는 이메일 형식으로 입력하세요'),
  password: z.string().refine(validPw, '비밀번호는 6자 이상'),
  name: z.string().min(1, '이름을 입력하세요').max(40),
});

/** POST — 매장 계정(대표자/안경사) 신규 등록. 아이디=이메일. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT', detail: parsed.error.flatten() }, { status: 400 });
  }
  const { storeRole, email, password, name } = parsed.data;

  const dup = await db.select({ id: users.id }).from(users).where(and(eq(users.email, email), isNull(users.deletedAt))).limit(1);
  if (dup[0]) return NextResponse.json({ error: 'EMAIL_TAKEN', message: '이미 사용 중인 아이디(이메일)입니다' }, { status: 409 });

  const [row] = await db
    .insert(users)
    .values({
      email,
      passwordHash: await hashPassword(password),
      role: 'store_staff',
      storeId: params.id,
      storeRole,
      name,
      isActive: true,
    })
    .returning({ id: users.id, email: users.email, name: users.name, storeRole: users.storeRole });
  return NextResponse.json({ account: row });
}

const patchSchema = z.object({
  id: z.string().uuid(),
  password: z.string().refine(validPw, '비밀번호는 6자 이상').optional(),
  name: z.string().min(1).max(40).optional(),
  isActive: z.boolean().optional(),
  storeRole: z.enum(['owner', 'optician']).optional(),
});

/** PATCH — 매장 계정 비밀번호 재설정 / 이름 / 활성 / 역할(대표자↔안경사). */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT', detail: parsed.error.flatten() }, { status: 400 });
  }
  const { id, password, name, isActive, storeRole } = parsed.data;

  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, id), eq(users.storeId, params.id), eq(users.role, 'store_staff'), isNull(users.deletedAt)))
    .limit(1);
  if (!target) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  await db
    .update(users)
    .set({
      ...(password ? { passwordHash: await hashPassword(password) } : {}),
      ...(name !== undefined ? { name } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(storeRole !== undefined ? { storeRole } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, id));
  return NextResponse.json({ ok: true });
}
