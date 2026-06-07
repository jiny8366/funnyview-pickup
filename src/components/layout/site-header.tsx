import Link from 'next/link';
import { ShopHeaderNav } from '@/components/shop/shop-header-nav';

/**
 * 전 고객 페이지 공용 헤더 (홈·상품·장바구니 통합).
 * 로고 + 렌즈쇼핑/매장찾기 + 장바구니 + 인증메뉴(ShopHeaderNav).
 * 인증메뉴는 로그인 여부를 스스로 감지해 비로그인=로그인/가입, 로그인=로그아웃(햄버거 하단) 으로 표시.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/95 backdrop-blur-sm" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3 md:px-6">
        <Link href="/" className="truncate text-base font-bold tracking-tight text-gray-900 hover:opacity-70 transition-opacity md:text-lg">
          Funnyview Pickup
        </Link>
        <nav className="flex items-center gap-1.5 text-sm text-gray-600 md:gap-4">
          <Link href="/products" className="hidden font-medium text-gray-900 transition-colors hover:text-brand-600 md:inline">
            렌즈 쇼핑
          </Link>
          <Link href="/stores" className="hidden transition-colors hover:text-gray-900 md:inline">
            매장찾기
          </Link>
          <ShopHeaderNav />
        </nav>
      </div>
    </header>
  );
}
