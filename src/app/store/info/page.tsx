import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { stores } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { IconStore } from '@/components/ui/icons';

export const dynamic = 'force-dynamic';

export default async function StoreInfoPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login/store');
  if (!user.storeId) {
    return (
      <EmptyState
        icon={<IconStore size={28} />}
        title="소속 매장 정보가 없습니다"
        description="관리자에게 문의해 주세요."
      />
    );
  }

  const [store] = await db.select().from(stores).where(eq(stores.id, user.storeId)).limit(1);
  if (!store) {
    return (
      <EmptyState
        icon={<IconStore size={28} />}
        title="매장 정보를 찾을 수 없습니다"
        description="관리자에게 문의해 주세요."
      />
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold md:text-2xl">매장 정보</h1>
        <p className="mt-1 text-sm text-gray-500">본 매장의 기본 정보입니다. 수정은 관리자에게 요청해주세요.</p>
      </header>

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <IconStore size={18} className="text-brand-500" />
              {store.name}
            </CardTitle>
            <CardDescription>
              {store.isActive ? '✅ 운영 중' : '⏸ 비활성'} · 수수료율 {store.commissionRate ?? '—'}%
            </CardDescription>
          </div>
        </CardHeader>
        <CardBody>
          <dl className="grid gap-3 text-sm md:grid-cols-2">
            <Row label="가맹점 코드">
              <span className="font-mono text-xs">{store.code}</span>
            </Row>
            <Row label="전화번호">{store.phone}</Row>
            <Row label="주소">
              {store.addressLine1}
              {store.addressLine2 ? ` ${store.addressLine2}` : ''}
            </Row>
            <Row label="우편번호">{store.postalCode ?? '—'}</Row>
            <Row label="대표자">{store.representativeName ?? '—'}</Row>
            <Row label="사업자번호">{store.businessNumber ?? '—'}</Row>
            <Row label="영업시간">
              {store.businessHours ? (
                <span className="text-xs">설정됨 (관리자 화면에서 확인)</span>
              ) : (
                '—'
              )}
            </Row>
            <Row label="등록일">
              {new Date(store.createdAt).toLocaleDateString('ko-KR')}
            </Row>
          </dl>
        </CardBody>
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-gray-900">{children}</dd>
    </div>
  );
}
