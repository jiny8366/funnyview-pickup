import { NextResponse } from 'next/server';
import { desc, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { lenses } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return null;
  return user;
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const rows = await db
    .select()
    .from(lenses)
    .where(isNull(lenses.deletedAt))
    .orderBy(desc(lenses.createdAt));

  return NextResponse.json({ lenses: rows });
}

export async function POST(req: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const {
    productCode,
    brand,
    name,
    lensType,
    replacementCycle,
    piecesPerBox,
    price,
    cost,
    imageUrl,
    description,
    baseCurve,
    diameter,
    waterContent,
    material,
    sphereMin,
    sphereMax,
    mfdsPermitNo,
    mfdsClassificationCode,
    mfdsProductName,
    manufacturer,
  } = body ?? {};

  if (!productCode || !brand || !name || !lensType || !replacementCycle || price == null) {
    return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 });
  }

  const [row] = await db
    .insert(lenses)
    .values({
      productCode,
      brand,
      name,
      lensType,
      replacementCycle,
      piecesPerBox: piecesPerBox ?? 1,
      price: Number(price),
      cost: cost == null ? null : Number(cost),
      imageUrl: imageUrl || null,
      description: description ?? null,
      baseCurve: baseCurve != null && baseCurve !== '' ? String(baseCurve) : null,
      diameter: diameter != null && diameter !== '' ? String(diameter) : null,
      waterContent: waterContent != null && waterContent !== '' ? String(waterContent) : null,
      material: material ?? null,
      sphereMin: sphereMin != null && sphereMin !== '' ? String(sphereMin) : null,
      sphereMax: sphereMax != null && sphereMax !== '' ? String(sphereMax) : null,
      mfdsPermitNo: mfdsPermitNo || null,
      mfdsClassificationCode: mfdsClassificationCode || null,
      mfdsProductName: mfdsProductName || null,
      manufacturer: manufacturer || null,
    })
    .returning();

  return NextResponse.json({ lens: row });
}
