import Link from 'next/link';
import { desc, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { stores } from '@/db/schema';
import { PageHeader, PageWrap } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { IconPlus, IconStore } from '@/components/ui/icons';
import { requirePermissionOrRedirect } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export default async function AdminStoresPage() {
  await requirePermissionOrRedirect('stores_read');
  const rows = await db
    .select()
    .from(stores)
    .where(isNull(stores.deletedAt))
    .orderBy(desc(stores.createdAt));

  return (
    <PageWrap>
      <PageHeader
        title="픽업가맹점"
        description="픽업 서비스 가맹점을 등록하고 운영 정보를 관리합니다."
        actions={
          <Button className="gap-1.5" disabled title="다음 단계에서 활성화">
            <IconPlus size={16} /> 가맹점 추가
          </Button>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<IconStore size={28} />}
          title="등록된 가맹점이 없습니다"
          description="첫 픽업가맹점을 등록하면 고객 주문이 해당 매장으로 라우팅됩니다."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <Th>이름</Th>
                <Th>주소</Th>
                <Th>전화</Th>
                <Th className="text-right">수수료율</Th>
                <Th className="text-center">상태</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <Td className="font-medium text-gray-900">{s.name}</Td>
                  <Td className="text-gray-600">{s.addressLine1 ?? '—'}</Td>
                  <Td className="font-mono text-xs text-gray-600">{s.phone ?? '—'}</Td>
                  <Td className="text-right text-gray-700">
                    {s.commissionRate ? `${s.commissionRate}%` : '—'}
                  </Td>
                  <Td className="text-center">
                    {s.isActive ? (
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        활성
                      </span>
                    ) : (
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
                        비활성
                      </span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageWrap>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 ${className ?? ''}`}
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className ?? ''}`}>{children}</td>;
}
