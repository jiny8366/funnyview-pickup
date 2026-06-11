import Link from 'next/link';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { stores } from '@/db/schema';
import { PageHeader, PageWrap } from '@/components/admin/page-header';
import { StaffForm } from '@/components/admin/staff-form';
import { IconArrowLeft } from '@/components/ui/icons';
import { requirePermissionOrRedirect } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export default async function NewStaffPage() {
  await requirePermissionOrRedirect('staff_manage');
  const storeRows = await db
    .select({ id: stores.id, name: stores.name })
    .from(stores)
    .where(and(eq(stores.isActive, true), isNull(stores.deletedAt)))
    .orderBy(asc(stores.sortOrder), asc(stores.name));

  return (
    <PageWrap>
      <PageHeader
        title="새 계정 등록"
        description="퍼니뷰 관리자 · 픽업관리 · 픽업가맹점 직원 계정을 등록합니다."
        actions={
          <Link
            href="/admin/staff"
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            <IconArrowLeft size={16} /> 목록으로
          </Link>
        }
      />
      <StaffForm mode="create" stores={storeRows} />
    </PageWrap>
  );
}
