import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { lensBarcodes, lensVariants, lenses } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { withDbRetry } from '@/lib/db/retry';

export const dynamic = 'force-dynamic';

const schema = z.object({ barcode: z.string().trim().min(1) });

/**
 * 패킹 검수 — 바코드 스캔 매칭 (보드 패킹검수 / M3 백엔드).
 * USB 스캐너(키보드 입력)로 찍힌 바코드를 variant 로 해석해 검수 화면(M1)이
 * 주문 품목과 크로스체크한다. 미등록 바코드 = 404 (오패킹 경고).
 */
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me || (me.role !== 'warehouse_staff' && me.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }

  const rows = await withDbRetry(() =>
    db
      .select({
        variantId: lensBarcodes.variantId,
        barcode: lensBarcodes.barcode,
        sku: lensVariants.sku,
        sphere: lensVariants.sphere,
        cylinder: lensVariants.cylinder,
        axis: lensVariants.axis,
        addPower: lensVariants.addPower,
        lensName: lenses.name,
        lensBrand: lenses.brand,
      })
      .from(lensBarcodes)
      .innerJoin(lensVariants, eq(lensVariants.id, lensBarcodes.variantId))
      .innerJoin(lenses, eq(lenses.id, lensVariants.lensId))
      .where(eq(lensBarcodes.barcode, parsed.data.barcode))
      .limit(1),
  );

  if (!rows[0]) {
    return NextResponse.json(
      { error: 'BARCODE_NOT_FOUND', message: '등록되지 않은 바코드입니다 — 제품을 확인하세요.' },
      { status: 404 },
    );
  }
  return NextResponse.json({ match: rows[0] });
}
