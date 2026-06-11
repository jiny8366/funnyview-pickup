import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { storeProductCommissionHistory, users } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

function isAdmin(user: { role: string; isMaster: boolean; permissions: string[] }) {
  return user.role === 'admin' || user.isMaster || user.permissions.includes('stores_write');
}

const ACTION_LABEL: Record<string, string> = {
  set: '신규',
  update: '변경',
  delete: '삭제',
};

function csvCell(v: string | null | undefined): string {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * GET /api/admin/stores/[id]/commission-history
 *   매장 제품별 수수료율 변경이력. changedAt desc.
 *   ?format=csv → UTF-8 BOM CSV 백업(일시/제품/브랜드/동작/이전율/변경율/변경자).
 *   admin(또는 stores_write) 전용.
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'admin only' }, { status: 403 });
  }

  const rows = await db
    .select({
      id: storeProductCommissionHistory.id,
      lensId: storeProductCommissionHistory.lensId,
      brand: storeProductCommissionHistory.brand,
      productName: storeProductCommissionHistory.productName,
      action: storeProductCommissionHistory.action,
      oldRate: storeProductCommissionHistory.oldRate,
      newRate: storeProductCommissionHistory.newRate,
      changedBy: storeProductCommissionHistory.changedBy,
      changedAt: storeProductCommissionHistory.changedAt,
      changedByName: users.name,
      changedByUsername: users.username,
    })
    .from(storeProductCommissionHistory)
    .leftJoin(users, eq(users.id, storeProductCommissionHistory.changedBy))
    .where(eq(storeProductCommissionHistory.storeId, params.id))
    .orderBy(desc(storeProductCommissionHistory.changedAt));

  const history = rows.map((r) => ({
    ...r,
    changedByLabel: r.changedByName || r.changedByUsername || null,
  }));

  const url = new URL(req.url);
  if (url.searchParams.get('format') === 'csv') {
    const header = ['일시', '제품', '브랜드', '동작', '이전율(%)', '변경율(%)', '변경자'];
    const lines = [header.join(',')];
    for (const r of history) {
      lines.push(
        [
          csvCell(r.changedAt ? new Date(r.changedAt).toLocaleString('ko-KR') : ''),
          csvCell(r.productName),
          csvCell(r.brand),
          csvCell(ACTION_LABEL[r.action] ?? r.action),
          csvCell(r.oldRate),
          csvCell(r.newRate),
          csvCell(r.changedByLabel),
        ].join(','),
      );
    }
    const csv = '﻿' + lines.join('\r\n');
    return new NextResponse(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="commission-history-${params.id}.csv"`,
      },
    });
  }

  return NextResponse.json({ history });
}

/**
 * DELETE /api/admin/stores/[id]/commission-history
 *   해당 매장의 변경이력 전체 삭제(백업 후 권장). admin(또는 stores_write) 전용.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'admin only' }, { status: 403 });
  }

  await db
    .delete(storeProductCommissionHistory)
    .where(eq(storeProductCommissionHistory.storeId, params.id));

  return NextResponse.json({ ok: true });
}
