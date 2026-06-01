import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { lenses } from '@/db/schema';

export const dynamic = 'force-dynamic';

/**
 * 고객 쇼핑 카탈로그 API — 컬러/이미지 데이터 포함.
 * /api/lenses (주문 플로우용) 와 분리된 별도 엔드포인트.
 *
 * DB 장애 시에도 500 으로 고객 브라우징 전체를 깨뜨리지 않고,
 * 빈 목록 + degraded 플래그로 우아하게 degrade 한다.
 */
export async function GET() {
  try {
    const rows = await db
      .select({
        id: lenses.id,
        productCode: lenses.productCode,
        brand: lenses.brand,
        name: lenses.name,
        lensType: lenses.lensType,
        replacementCycle: lenses.replacementCycle,
        piecesPerBox: lenses.piecesPerBox,
        price: lenses.price,
        imageUrl: lenses.imageUrl,
        colorName: lenses.colorName,
        colorHex: lenses.colorHex,
        colorPreviewUrl: lenses.colorPreviewUrl,
        seriesCode: lenses.seriesCode,
        isNew: lenses.isNew,
        diameter: lenses.diameter,
      })
      .from(lenses)
      .where(and(eq(lenses.isActive, true), isNull(lenses.deletedAt)))
      .orderBy(lenses.brand, lenses.name);

    return NextResponse.json({ lenses: rows });
  } catch (err) {
    console.error('[api/catalog] DB 조회 실패 — 빈 목록으로 degrade:', err);
    return NextResponse.json({ lenses: [], degraded: true });
  }
}
