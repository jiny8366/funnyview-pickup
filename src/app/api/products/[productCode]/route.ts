import { NextResponse } from 'next/server';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { inventory, lensVariants, lenses } from '@/db/schema';

export const dynamic = 'force-dynamic';

/**
 * 단일 제품 상세 + variant(SKU) 목록 + 가용재고.
 * /products/[productCode] 상세 페이지가 호출.
 */
export async function GET(
  _req: Request,
  { params }: { params: { productCode: string } },
) {
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
      baseCurve: lenses.baseCurve,
      waterContent: lenses.waterContent,
      material: lenses.material,
      manufacturer: lenses.manufacturer,
      mfdsPermitNo: lenses.mfdsPermitNo,
      description: lenses.description,
      variantId: lensVariants.id,
      sku: lensVariants.sku,
      sphere: lensVariants.sphere,
      cylinder: lensVariants.cylinder,
      axis: lensVariants.axis,
      addPower: lensVariants.addPower,
      priceOverride: lensVariants.priceOverride,
      variantIsActive: lensVariants.isActive,
      available: sql<number>`COALESCE(${inventory.quantityOnHand} - ${inventory.quantityReserved}, 0)`,
    })
    .from(lenses)
    .leftJoin(lensVariants, eq(lensVariants.lensId, lenses.id))
    .leftJoin(inventory, eq(inventory.variantId, lensVariants.id))
    .where(
      and(
        eq(lenses.productCode, params.productCode),
        eq(lenses.isActive, true),
        isNull(lenses.deletedAt),
      ),
    )
    .orderBy(lensVariants.sphere);

  if (rows.length === 0) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  // 같은 시리즈 다른 컬러 (variantSiblings) — 컬러렌즈만
  const head = rows[0];
  const siblings = head.seriesCode
    ? await db
        .select({
          id: lenses.id,
          productCode: lenses.productCode,
          name: lenses.name,
          colorName: lenses.colorName,
          colorHex: lenses.colorHex,
          colorPreviewUrl: lenses.colorPreviewUrl,
          imageUrl: lenses.imageUrl,
          price: lenses.price,
          piecesPerBox: lenses.piecesPerBox,
        })
        .from(lenses)
        .where(
          and(
            eq(lenses.seriesCode, head.seriesCode),
            eq(lenses.piecesPerBox, head.piecesPerBox), // 같은 팩사이즈만
            eq(lenses.isActive, true),
            isNull(lenses.deletedAt),
          ),
        )
        .orderBy(lenses.name)
    : [];

  const product = {
    id: head.id,
    productCode: head.productCode,
    brand: head.brand,
    name: head.name,
    lensType: head.lensType,
    replacementCycle: head.replacementCycle,
    piecesPerBox: head.piecesPerBox,
    price: head.price,
    imageUrl: head.imageUrl,
    colorName: head.colorName,
    colorHex: head.colorHex,
    colorPreviewUrl: head.colorPreviewUrl,
    seriesCode: head.seriesCode,
    isNew: head.isNew,
    diameter: head.diameter,
    baseCurve: head.baseCurve,
    waterContent: head.waterContent,
    material: head.material,
    manufacturer: head.manufacturer,
    mfdsPermitNo: head.mfdsPermitNo,
    description: head.description,
    variants: rows
      .filter((r) => r.variantId && r.variantIsActive)
      .map((r) => ({
        variantId: r.variantId!,
        sku: r.sku!,
        sphere: r.sphere!,
        cylinder: r.cylinder,
        axis: r.axis,
        addPower: r.addPower,
        price: r.priceOverride ?? r.price,
        available: Number(r.available ?? 0),
      })),
    siblings: siblings.filter((s) => s.productCode !== head.productCode),
  };

  return NextResponse.json({ product });
}
