import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { customers, orders } from '@/db/schema';
import { CustomerEditForm } from '@/components/admin/customer-edit-form';
import { PrescriptionManager } from '@/components/prescription/prescription-manager';
import { PageHeader, PageWrap } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { requirePermissionOrRedirect, userHasPermissionOrIsMaster } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: '결제대기',
  paid: '결제완료',
  accepted: '접수',
  picking: '피킹',
  shipped: '출고',
  arrived: '도착',
  ready: '픽업대기',
  completed: '완료',
  cancelled: '취소',
};

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const me = await requirePermissionOrRedirect('customers_read');
  const canWrite = userHasPermissionOrIsMaster(me, 'customers_write');

  const [c] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, params.id), isNull(customers.deletedAt)))
    .limit(1);

  if (!c) notFound();

  let referrerName: string | null = null;
  if (c.referredById) {
    const [ref] = await db
      .select({ name: customers.name })
      .from(customers)
      .where(eq(customers.id, c.referredById))
      .limit(1);
    referrerName = ref?.name ?? null;
  }

  const orderRows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      total: orders.total,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.customerId, c.id))
    .orderBy(desc(orders.createdAt))
    .limit(20);

  return (
    <PageWrap>
      <PageHeader
        title={c.name}
        description="고객 상세 정보 · 주문 이력 · 관리자 메모"
        actions={
          <Link href="/admin/customers">
            <Button variant="secondary">목록으로</Button>
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CustomerEditForm
            customerId={c.id}
            canWrite={canWrite}
            initial={{
              name: c.name,
              phone: c.phone,
              gender: c.gender,
              birthDate: c.birthDate,
              postalCode: c.postalCode,
              addressLine1: c.addressLine1,
              addressLine2: c.addressLine2,
              landlinePhone: c.landlinePhone,
              memberType: c.memberType,
              adminMemo: c.adminMemo,
            }}
          />
          <PrescriptionManager
            endpoint={`/api/admin/customers/${c.id}/prescriptions`}
            canEdit={canWrite}
          />
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-bold text-gray-900">추천 정보</h2>
            <dl className="space-y-2 text-sm">
              <InfoRow label="가입일" value={new Date(c.createdAt).toLocaleDateString('ko-KR')} />
              <InfoRow label="내 추천코드" value={c.referrerCode ?? '—'} />
              <InfoRow label="추천인" value={referrerName ?? c.referredByCode ?? '—'} />
            </dl>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-bold text-gray-900">
              주문 이력 ({orderRows.length})
            </h2>
            {orderRows.length === 0 ? (
              <p className="text-sm text-gray-400">주문 내역이 없습니다.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {orderRows.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs text-gray-700">{o.orderNumber}</p>
                      <p className="text-[11px] text-gray-400">
                        {new Date(o.createdAt).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium text-gray-800">
                        {o.total.toLocaleString()}원
                      </p>
                      <span className="text-[11px] text-gray-500">
                        {ORDER_STATUS_LABEL[o.status] ?? o.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </PageWrap>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-gray-800">{value}</dd>
    </div>
  );
}
