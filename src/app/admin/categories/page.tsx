import { PageHeader, PageWrap } from '@/components/admin/page-header';
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { IconTag } from '@/components/ui/icons';
import { requirePermissionOrRedirect } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

const AXES = [
  {
    title: '브랜드별',
    desc: 'ACUVUE, Bausch+Lomb, Alcon, CooperVision, 인터로조 등',
    examples: ['ACUVUE', 'Bausch+Lomb', '인터로조'],
  },
  {
    title: '교체 주기별',
    desc: '원데이 / 2주 / 1개월 / 3·6개월 / 1년',
    examples: ['원데이', '2주', '1개월'],
  },
  {
    title: '렌즈 유형별',
    desc: '일반(구면) / 난시(토릭) / 다초점 / 컬러 / 써클',
    examples: ['난시', '컬러', '다초점'],
  },
  {
    title: '직경별',
    desc: '13.4 / 13.8 / 14.0 / 14.2 / 14.5mm',
    examples: ['14.2mm', '14.5mm'],
  },
  {
    title: '기능별',
    desc: 'UV 차단 / 고함수 / 실리콘 / 항산화',
    examples: ['UV 차단', '실리콘'],
  },
  {
    title: '가격대별',
    desc: '~2만원 / 2-3만원 / 3-5만원 / 5만원+',
    examples: ['~2만원', '3-5만원'],
  },
];

export default async function AdminCategoriesPage() {
  await requirePermissionOrRedirect('categories_write');

  return (
    <PageWrap>
      <PageHeader
        title="카테고리"
        description="제품 분류 축. 6가지 카테고리 축을 자동으로 생성합니다 (마이그레이션 후 활성화 예정)."
      />

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {AXES.map((a) => (
          <Card key={a.title}>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <IconTag size={16} className="text-brand-500" />
                  {a.title}
                </CardTitle>
                <CardDescription>{a.desc}</CardDescription>
              </div>
            </CardHeader>
            <CardBody>
              <div className="flex flex-wrap gap-1.5">
                {a.examples.map((e) => (
                  <span key={e} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">
                    {e}
                  </span>
                ))}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-dashed border-gray-200 bg-white p-5 text-sm text-gray-600">
        💡 카테고리는 제품의 메타데이터를 기반으로 자동 분류됩니다. 신규 카테고리 축 추가는 데이터 모델 협의 후 진행합니다.
      </div>
    </PageWrap>
  );
}
