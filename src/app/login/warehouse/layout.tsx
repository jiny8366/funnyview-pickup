import type { Metadata } from 'next';

// 브라우저 탭 제목 — 포털 표시명에 맞춤 (JINY 지시)
export const metadata: Metadata = {
  title: { absolute: '픽업관리 로그인' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
