import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin/admin-shell';
import { getCurrentUser } from '@/lib/auth/current-user';

// 포털별 브라우저 탭 제목 — 호스트(링크)에 맞춰 표시 (JINY 지시)
export const metadata: Metadata = {
  title: { absolute: '퍼니뷰 관리자', template: '%s | 퍼니뷰 관리자' },
};

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login/admin?next=' + encodeURIComponent('/admin/dashboard'));
  }
  if (user.role !== 'admin') {
    redirect('/');
  }

  const host = headers().get('host') ?? '';

  return (
    <AdminShell
      user={{ phone: user.phone ?? '' }}
      permissions={user.permissions}
      isMaster={user.isMaster}
      host={host}
    >
      {children}
    </AdminShell>
  );
}
