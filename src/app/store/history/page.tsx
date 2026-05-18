import { EmptyState } from '@/components/ui/empty-state';
import { IconClipboard } from '@/components/ui/icons';

export const dynamic = 'force-dynamic';

export default function StoreHistoryPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold md:text-2xl">처리 이력</h1>
        <p className="mt-1 text-sm text-gray-500">
          처리완료된 주문의 30일 내역을 조회합니다. 날짜·고객·매출 필터링 가능.
        </p>
      </header>
      <EmptyState
        icon={<IconClipboard size={28} />}
        title="처리 이력 화면이 곧 활성화됩니다"
        description="실제 픽업 완료 주문이 누적되면 이곳에서 검색·다운로드 할 수 있습니다."
      />
    </div>
  );
}
