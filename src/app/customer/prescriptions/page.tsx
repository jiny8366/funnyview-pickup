import { PrescriptionManager } from '@/components/prescription/prescription-manager';

export const dynamic = 'force-dynamic';

export default function CustomerPrescriptionsPage() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold">내 시력정보</h1>
        <p className="mt-2 text-gray-500">
          안경·콘택트 도수를 기록해 두면 재주문이 편리합니다. 안경 도수는 변환 버튼으로 콘택트 도수로 환산할 수 있습니다.
        </p>
      </section>
      <PrescriptionManager endpoint="/api/customer/prescriptions" canEdit />
    </div>
  );
}
