import type { Metadata, Viewport } from 'next';
import { ServiceWorkerRegister } from '@/components/pwa/sw-register';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: {
    default: '퍼니뷰 예약시스템',
    template: '%s | 퍼니뷰 예약시스템',
  },
  description: '콘택트렌즈 예약 서비스 - 주문하고 가까운 가맹점에서 픽업하세요',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: '퍼니뷰 예약',
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
      <body className="min-h-screen antialiased">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
