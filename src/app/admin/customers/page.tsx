import Link from 'next/link';
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { customers, orders } from '@/db/schema';
import { PageHeader, PageWrap } from '@/components/admin/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { IconEdit, IconSearch, IconUser } from '@/components/ui/icons';
import { requirePermissionOrRedirect } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

const MEMBER_TYPE_LABEL: Record<string, string> = {
  individual: '개인',
  business: '사업자',
};

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  await requirePermissionOrRedirect('customers_read');

  const q = (searchParams.q ?? '').trim();
  const search =
    q.length > 0
      ? or(ilike(customers.name, `%${q}%`), ilike(customers.phone, `%${q}%`))
      : undefined;

  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      memberType: customers.memberType,
      createdAt: customers.createdAt,
      orderCount: sql<number>`COUNT(${orders.id}) FILTER (WHERE ${orders.status} != 'cancelled')`,
    })
    .from(customers)
    .leftJoin(orders, eq(orders.customerId, customers.id))
    .where(and(isNull(customers.deletedAt), search))
    .groupBy(customers.id)
    .orderBy(desc(customers.createdAt))
    .limit(200);

  return (
    <PageWrap>
      <PageHeader
        title="고객 관리"
        description="가입 고객을 조회하고 정보를 관리합니다."
      />

      <form className="mb-4 flex gap-2" action="/admin/customers" method="get">
        <div className="relative flex-1 max-w-sm">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <IconSearch size={16} />
          </span>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="이름 또는 전화번호 검색"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm placeholder-gray-400 focus:border-brand-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black"
        >
          검색
        </button>
        {q.length > 0 && (
          <Link
            href="/admin/customers"
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            초기화
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={<IconUser size={28} />}
          title={q.length > 0 ? '검색 결과가 없습니다' : '등록된 고객이 없습니다'}
          description={
            q.length > 0
              ? '다른 이름 또는 전화번호로 검색해보세요.'
              : '고객이 가입하면 이곳에 표시됩니다.'
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <Th>이름</Th>
                <Th>전화번호</Th>
                <Th>회원유형</Th>
                <Th>가입일</Th>
                <Th className="text-center">주문</Th>
                <Th className="text-center">편집</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <Td>
                    <Link
                      href={`/admin/customers/${c.id}`}
                      className="font-medium text-gray-800 hover:text-brand-600 hover:underline"
                    >
                      {c.name}
                    </Link>
                  </Td>
                  <Td className="font-mono text-xs text-gray-600">{c.phone}</Td>
                  <Td>
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                      {MEMBER_TYPE_LABEL[c.memberType] ?? c.memberType}
                    </span>
                  </Td>
                  <Td className="text-gray-600">
                    {new Date(c.createdAt).toLocaleDateString('ko-KR')}
                  </Td>
                  <Td className="text-center text-gray-700">{Number(c.orderCount)}</Td>
                  <Td className="text-center">
                    <Link
                      href={`/admin/customers/${c.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-brand-600"
                    >
                      <IconEdit size={12} /> 편집
                    </Link>
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
