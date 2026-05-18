import { PageHeader, PageWrap } from '@/components/admin/page-header';
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

const SECTIONS = [
  {
    title: '회사 정보',
    desc: '상호 · 사업자번호 · 통신판매신고번호 · 대표자 정보',
    status: 'pending',
  },
  {
    title: '결제 PG',
    desc: 'Toss / Nice / PortOne 어댑터 설정 및 API 키 관리',
    status: 'pending',
  },
  {
    title: '알림 채널',
    desc: 'Solapi (SMS · 카카오 알림톡) 발신번호 및 템플릿',
    status: 'env',
  },
  {
    title: '소셜 로그인',
    desc: 'Naver · Kakao · Google OAuth 클라이언트 ID/Secret',
    status: 'env',
  },
  {
    title: '웹 푸시 (VAPID)',
    desc: '브라우저 푸시 알림 키 페어',
    status: 'env',
  },
  {
    title: '추천인 보상',
    desc: '추천 코드 적용 시 보상 비율 (현재 3%)',
    status: 'env',
  },
];

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  env: { label: 'ENV 환경변수', cls: 'bg-blue-50 text-blue-700' },
  pending: { label: '추후 활성화', cls: 'bg-gray-100 text-gray-600' },
};

export default function AdminSettingsPage() {
  return (
    <PageWrap>
      <PageHeader
        title="설정"
        description="시스템 운영 설정. 보안 민감 항목은 Vercel 환경변수로 관리됩니다."
      />

      <div className="grid gap-3 md:grid-cols-2">
        {SECTIONS.map((s) => {
          const badge = STATUS_BADGE[s.status];
          return (
            <Card key={s.title}>
              <CardHeader>
                <div className="flex-1">
                  <CardTitle>{s.title}</CardTitle>
                  <CardDescription>{s.desc}</CardDescription>
                </div>
                <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${badge.cls}`}>
                  {badge.label}
                </span>
              </CardHeader>
              <CardBody>
                <p className="text-xs text-gray-500">
                  {s.status === 'env'
                    ? 'Vercel → Settings → Environment Variables 에서 관리하세요.'
                    : '관리 UI 는 다음 단계에서 제공됩니다.'}
                </p>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </PageWrap>
  );
}
