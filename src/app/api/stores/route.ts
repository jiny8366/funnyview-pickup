import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { stores } from '@/db/schema';
import { mapLinks } from '@/lib/utils/map-url';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(stores)
      .where(eq(stores.isActive, true))
      .orderBy(stores.name); // 가맹점명 가나다순

    return NextResponse.json({
      stores: rows.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        phone: s.phone,
        address: [s.addressLine1, s.addressLine2].filter(Boolean).join(' '),
        postalCode: s.postalCode,
        mapLinks: mapLinks(s),
      })),
    });
  } catch (err) {
    console.error('[api/stores] DB 조회 실패 — 빈 목록으로 degrade:', err);
    return NextResponse.json({ stores: [], degraded: true });
  }
}
