import { EmptyState } from '@/components/ui/empty-state';
import { IconBox } from '@/components/ui/icons';

export const dynamic = 'force-dynamic';

export default function WarehouseReturnsPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold md:text-2xl">반품 관리</h1>
        <p className="mt-1 text-sm text-gray-500">
          가맹점/고객 반품을 입고 처리합니다. 사유별 통계 + 재고 복원 흐름 제공 예정.
        </p>
      </header>
      <EmptyState
        icon={<IconBox size={28} />}
        title="반품 건이 없습니다"
        description="가맹점에서 반품 요청 시 이곳에 표시됩니다."
      />
    </div>
  );
}
