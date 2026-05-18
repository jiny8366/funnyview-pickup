import Link from 'next/link';
import { PageHeader, PageWrap } from '@/components/admin/page-header';
import { ProductForm } from '@/components/admin/product-form';
import { IconArrowLeft } from '@/components/ui/icons';

export default function NewProductPage() {
  return (
    <PageWrap>
      <PageHeader
        title="새 제품 등록"
        description="제품 마스터를 등록합니다. 도수별 SKU 는 등록 후 상세 페이지에서 추가하세요."
        actions={
          <Link
            href="/admin/products"
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            <IconArrowLeft size={16} /> 목록으로
          </Link>
        }
      />
      <ProductForm mode="create" />
    </PageWrap>
  );
}
