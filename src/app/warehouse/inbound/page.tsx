import { EmptyState } from '@/components/ui/empty-state';
import { IconBox } from '@/components/ui/icons';

export const dynamic = 'force-dynamic';

export default function WarehouseInboundPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold md:text-2xl">입고 관리</h1>
        <p className="mt-1 text-sm text-gray-500">
          공급사로부터 입고된 상품의 재고를 등록합니다. 바코드 스캔 또는 수동 입력 모두 지원 예정.
        </p>
      </header>
      <EmptyState
        icon={<IconBox size={28} />}
        title="입고 등록 UI 는 다음 단계에서 활성화됩니다"
        description="식약처 UDI 통합 후, GTIN-13 스캔 시 자동으로 SKU 매칭 + 재고 증가 흐름이 구현됩니다."
      />
    </div>
  );
}
