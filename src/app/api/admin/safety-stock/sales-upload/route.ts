import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { historicalSales, lensVariants, lenses } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { withDbRetry } from '@/lib/db/retry';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return null;
  return user;
}

/**
 * 도수 문자열 정규화 — DB 표기(부호 없는 양수, 소수 둘째자리)와 일치시킴.
 * '−3' / '-3.0' → '-3.00', '+1.5' / '1.5' → '1.50', '0' → '0.00'
 */
function normDiopter(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = String(raw).trim().replace('−', '-').replace('+', '');
  if (t === '' || t === '-') return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return n.toFixed(2);
}

/** GET ?template=1 — 샘플 엑셀(CSV) 양식 다운로드 */
export async function GET(req: Request) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const url = new URL(req.url);
  if (url.searchParams.get('template') === '1') {
    const header = ['제품명', 'SPH', 'CYL', 'AXIS', 'ADD', '수량', '판매일(YYYY-MM-DD)'];
    const example = [
      ['미광 클리어원데이 10P', '-3.00', '', '', '', '2', '2026-05-20'],
      ['아큐브 오아시스 MAX 토릭 원데이 30P', '-2.75', '-1.25', '20', '', '1', '2026-05-21'],
    ];
    const csv =
      '﻿' +
      [header.join(','), ...example.map((r) => r.map((v) => `"${v}"`).join(','))].join('\r\n');
    return new NextResponse(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="sales-history-template.csv"',
      },
    });
  }

  // 업로드 현황 요약
  const [stat] = await withDbRetry(() =>
    db
      .select({
        rows: sql<number>`COUNT(*)::int`,
        qty: sql<number>`COALESCE(SUM(${historicalSales.quantity}),0)::int`,
        from: sql<string | null>`MIN(${historicalSales.soldOn})::text`,
        to: sql<string | null>`MAX(${historicalSales.soldOn})::text`,
      })
      .from(historicalSales),
  );
  return NextResponse.json({ summary: stat });
}

const rowSchema = z.object({
  productName: z.string().min(1),
  sphere: z.string().optional().nullable(),
  cylinder: z.string().optional().nullable(),
  axis: z.string().optional().nullable(),
  addPower: z.string().optional().nullable(),
  quantity: z.union([z.string(), z.number()]),
  soldOn: z.string(),
});
const uploadSchema = z.object({ rows: z.array(rowSchema).min(1).max(5000) });

/**
 * POST — 판매데이터 업로드 검수·저장 (JINY).
 * 모든 행을 검수해 유효 행만 저장하고, 오류 행은 사유와 함께 반환한다.
 */
export async function POST(req: Request) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const parsed = uploadSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT', detail: parsed.error.flatten() }, { status: 400 });
  }

  // 활성 제품·도수 전체 로드 → 메모리 매칭 (176제품/44k 도수 — 1회 조회로 충분)
  const variants = await withDbRetry(() =>
    db
      .select({
        variantId: lensVariants.id,
        lensName: lenses.name,
        sphere: lensVariants.sphere,
        cylinder: lensVariants.cylinder,
        axis: lensVariants.axis,
        addPower: lensVariants.addPower,
      })
      .from(lensVariants)
      .innerJoin(lenses, eq(lenses.id, lensVariants.lensId))
      .where(sql`${lenses.deletedAt} IS NULL`),
  );
  // 키: 제품명(공백정규화) | sph | cyl | axis | add
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  const key = (name: string, sph: string | null, cyl: string | null, axis: number | null, add: string | null) =>
    [norm(name), sph ?? '', cyl ?? '', axis ?? '', add ?? ''].join('|');
  const byKey = new Map<string, string>();
  const namesSet = new Set<string>();
  for (const v of variants) {
    byKey.set(key(v.lensName, v.sphere, v.cylinder, v.axis, v.addPower), v.variantId);
    namesSet.add(norm(v.lensName));
  }

  const today = new Date().toISOString().slice(0, 10);
  const valid: { variantId: string; quantity: number; soldOn: string }[] = [];
  const errors: { row: number; reason: string }[] = [];

  parsed.data.rows.forEach((r, idx) => {
    const rowNo = idx + 2; // 헤더 다음부터 (엑셀 행 번호)
    const qty = Number(r.quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      errors.push({ row: rowNo, reason: `수량이 올바르지 않습니다 (${r.quantity})` });
      return;
    }
    const soldOn = r.soldOn.trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(soldOn) || Number.isNaN(new Date(soldOn).getTime())) {
      errors.push({ row: rowNo, reason: `판매일 형식 오류 — YYYY-MM-DD (${r.soldOn})` });
      return;
    }
    if (soldOn > today) {
      errors.push({ row: rowNo, reason: `판매일이 미래입니다 (${soldOn})` });
      return;
    }
    if (!namesSet.has(norm(r.productName))) {
      errors.push({ row: rowNo, reason: `제품명을 찾을 수 없습니다 (${r.productName})` });
      return;
    }
    const sph = normDiopter(r.sphere);
    const cyl = normDiopter(r.cylinder);
    const add = normDiopter(r.addPower);
    const axisStr = (r.axis ?? '').toString().trim();
    const axis = axisStr === '' ? null : Number(axisStr);
    if (axis !== null && (!Number.isInteger(axis) || axis < 0 || axis > 180)) {
      errors.push({ row: rowNo, reason: `AXIS 값 오류 (${r.axis})` });
      return;
    }
    const variantId = byKey.get(key(r.productName, sph, cyl, axis, add));
    if (!variantId) {
      errors.push({
        row: rowNo,
        reason: `도수가 제품 스펙에 없습니다 (SPH ${sph ?? '—'}${cyl ? ` CYL ${cyl}` : ''}${axis !== null ? ` AX ${axis}` : ''}${add ? ` ADD ${add}` : ''})`,
      });
      return;
    }
    valid.push({ variantId, quantity: qty, soldOn });
  });

  if (valid.length > 0) {
    await db.insert(historicalSales).values(
      valid.map((v) => ({ ...v, uploadedBy: me.id })),
    );
  }

  return NextResponse.json({
    ok: true,
    inserted: valid.length,
    errorCount: errors.length,
    errors: errors.slice(0, 100), // 과다 응답 방지
  });
}
