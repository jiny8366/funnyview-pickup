import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { lenses } from '@/db/schema';
import { PageHeader, PageWrap } from '@/components/admin/page-header';
import { ProductForm } from '@/components/admin/product-form';
import { IconArrowLeft } from '@/components/ui/icons';

export const dynamic = 'force-dynamic';

export default async function EditProductPage({
  params,
}: {
  params: { id: string };
}) {
  const [row] = await db.select().from(lenses).where(eq(lenses.id, params.id)).limit(1);
  if (!row) notFound();

  return (
    <PageWrap>
      <PageHeader
        title={`${row.brand} ${row.name}`}
        description={`제품 코드: ${row.productCode}`}
        actions={
          <Link
            href="/admin/products"
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            <IconArrowLeft size={16} /> 목록으로
          </Link>
        }
      />
      <ProductForm
        mode="edit"
        initial={{
          id: row.id,
          productCode: row.productCode,
          brand: row.brand,
          name: row.name,
          lensType: row.lensType,
          replacementCycle: row.replacementCycle,
          piecesPerBox: row.piecesPerBox,
          price: row.price,
          cost: row.cost ?? '',
          imageUrl: row.imageUrl ?? '',
          baseCurve: row.baseCurve ?? '',
          diameter: row.diameter ?? '',
          waterContent: row.waterContent ?? '',
          material: row.material ?? '',
          sphereMin: row.sphereMin ?? '',
          sphereMax: row.sphereMax ?? '',
          mfdsPermitNo: row.mfdsPermitNo ?? '',
          mfdsClassificationCode: row.mfdsClassificationCode ?? '',
          mfdsProductName: row.mfdsProductName ?? '',
          manufacturer: row.manufacturer ?? '',
          colorName: row.colorName ?? '',
          colorHex: row.colorHex ?? '',
          colorPreviewUrl: row.colorPreviewUrl ?? '',
          seriesCode: row.seriesCode ?? '',
          isNew: row.isNew,
          isActive: row.isActive,
          description: row.description,
        }}
      />
    </PageWrap>
  );
}
