import { NextResponse } from 'next/server';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { lenses, lensVariants } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/lenses/bulk-activate
 *   body: { activate: boolean, includeVariants?: boolean }
 *
 * 모든 (deletedAt IS NULL) 제품과 옵션으로 도수까지 일괄 활성/비활성 전환.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const activate = body.activate !== false; // 기본 true
  const includeVariants = body.includeVariants !== false; // 기본 true

  const lensResult = await db
    .update(lenses)
    .set({ isActive: activate, updatedAt: new Date() })
    .where(and(isNull(lenses.deletedAt), eq(lenses.isActive, !activate)))
    .returning({ id: lenses.id });

  let variantCount = 0;
  if (includeVariants) {
    const variantResult = await db
      .update(lensVariants)
      .set({ isActive: activate, updatedAt: new Date() })
      .where(
        and(
          eq(lensVariants.isActive, !activate),
          sql`${lensVariants.lensId} IN (SELECT id FROM lenses WHERE deleted_at IS NULL)`,
        ),
      )
      .returning({ id: lensVariants.id });
    variantCount = variantResult.length;
  }

  return NextResponse.json({
    ok: true,
    updatedLenses: lensResult.length,
    updatedVariants: variantCount,
  });
}
