import { Breadcrumb } from '@/components/layout/breadcrumb';
import { SiteHeader } from '@/components/layout/site-header';
import { StoresFinder } from './stores-finder';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '픽업 매장 찾기 — Funnyview Pickup',
  description: '주변 픽업 가맹점을 찾아보세요. 콘택트렌즈 주문 후 가까운 매장에서 픽업할 수 있습니다.',
};

export default function PublicStoresPage() {
  return (
    <>
      <SiteHeader />
      <main className="animate-fade-in mx-auto w-full max-w-5xl px-4 py-6 md:py-10">
      <Breadcrumb items={[{ href: '/', label: '홈' }, { label: '매장 찾기' }]} />

      <header className="mt-4">
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">픽업 매장 찾기</h1>
        <p className="mt-2 text-sm text-gray-500">
          주문하신 콘택트렌즈를 가까운 가맹점에서 안경사 상담과 함께 픽업하실 수 있습니다.
        </p>
      </header>

      <StoresFinder />

      <section className="mt-10 rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">
        <h2 className="text-sm font-semibold text-gray-900">픽업 서비스 안내</h2>
        <ul className="mt-2 space-y-1 text-xs">
          <li>· 의료기기법에 따라 안경사 또는 안과의사의 처방전 (6개월 이내) 이 필요합니다.</li>
          <li>· 만 14세 미만은 픽업 서비스 이용이 제한됩니다.</li>
          <li>· 매장 방문 시 안경사 상담 + 가이드 후 수령합니다.</li>
        </ul>
      </section>
      </main>
    </>
  );
}
