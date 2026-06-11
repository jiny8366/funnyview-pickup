import type { Metadata, Viewport } from 'next';
import { ServiceWorkerRegister } from '@/components/pwa/sw-register';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: {
    default: '퍼니뷰 예약시스템',
    template: '%s | 퍼니뷰 예약시스템',
  },
  description: '퍼니뷰 콘택트렌즈 예약·픽업 — 주문하고 가까운 가맹점에서 픽업하세요',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: '퍼니뷰 예약시스템',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#2563eb',
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        {/* 운영 포털 다크 모드 무플래시 적용 — opsTheme=dark 면 페인트 전 클래스 부여(고객 origin은 미설정) */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('opsTheme')==='dark')document.documentElement.classList.add('theme-dark')}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-screen antialiased">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
