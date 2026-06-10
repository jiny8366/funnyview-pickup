import Link from 'next/link';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { stores, users } from '@/db/schema';
import { PageHeader, PageWrap } from '@/components/admin/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { IconEdit, IconPlus, IconUsers } from '@/components/ui/icons';
import { isMasterUser } from '@/lib/auth/permissions';
import { requirePermissionOrRedirect } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

const ROLE_LABEL: Record<string, string> = {
  admin: '관리자',
  warehouse_staff: '픽업서비스 업체',
  store_staff: '픽업가맹점',
  customer: '고객',
};

export default async function AdminStaffPage() {
  await requirePermissionOrRedirect('staff_read');
  const rawRows = await db
    .select({
      id: users.id,
      username: users.username,
      phone: users.phone,
      email: users.email,
      role: users.role,
      storeId: users.storeId,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    // 삭제(deletedAt)된 계정은 목록에서 제외 — 삭제 즉시 사라지도록.
    .where(
      and(
        inArray(users.role, ['admin', 'warehouse_staff', 'store_staff']),
        isNull(users.deletedAt),
      ),
    )
    .orderBy(desc(users.createdAt));

  // 마스터 계정은 목록에서 숨김 (env 기반 화이트리스트, 관리 대상 아님)
  const rows = rawRows.filter((r) => !isMasterUser(r.username, r.phone));

  const storeIds = rows.map((r) => r.storeId).filter((x): x is string => !!x);
  const storeRows = storeIds.length
    ? await db
        .select({ id: stores.id, name: stores.name })
        .from(stores)
        .where(inArray(stores.id, storeIds))
    : [];
  const storeMap = new Map(storeRows.map((s) => [s.id, s.name]));

  return (
    <PageWrap>
      <PageHeader
        title="직원 관리"
        description="관리자 · 픽업서비스 업체 · 가맹점 직원 계정을 관리합니다."
        actions={
          <Link
            href="/admin/staff/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black"
          >
            <IconPlus size={16} /> 계정 등록
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<IconUsers size={28} />}
          title="등록된 직원이 없습니다"
          description="우측 상단 '계정 등록' 으로 새 관리자 · 직원을 추가하세요."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <Th>이메일 (로그인 ID)</Th>
                <Th>전화번호</Th>
                <Th>역할</Th>
                <Th>소속 가맹점</Th>
                <Th className="text-center">상태</Th>
                <Th className="text-center">편집</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((u) => {
                const userIsMaster = isMasterUser(u.username, u.phone);
                return (
                <tr key={u.id} className="hover:bg-gray-50">
                  <Td className="font-mono text-xs">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/admin/staff/${u.id}`}
                        className="text-gray-700 hover:text-brand-600 hover:underline"
                      >
                        {u.email ?? u.username ?? '—'}
                      </Link>
                      {userIsMaster && (
                        <span
                          className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700"
                          title="MASTER_USERNAMES 환경변수에 등록된 최상위 권한"
                        >
                          🛡 마스터
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td className="font-mono text-xs text-gray-600">{u.phone ?? '—'}</Td>
                  <Td>
                    <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${roleColor(u.role)}`}>
                      {ROLE_LABEL[u.role] ?? u.role}
                    </span>
                  </Td>
                  <Td className="text-gray-700">{u.storeId ? storeMap.get(u.storeId) ?? '—' : '—'}</Td>
                  <Td className="text-center">
                    {u.isActive ? (
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        활성
                      </span>
                    ) : (
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
                        비활성
                      </span>
                    )}
                  </Td>
                  <Td className="text-center">
                    <Link
                      href={`/admin/staff/${u.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-brand-600"
                    >
                      <IconEdit size={12} /> 편집
                    </Link>
                  </Td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageWrap>
  );
}

function roleColor(role: string) {
  switch (role) {
    case 'admin':
      return 'bg-red-50 text-red-700';
    case 'warehouse_staff':
      return 'bg-emerald-50 text-emerald-700';
    case 'store_staff':
      return 'bg-amber-50 text-amber-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
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
