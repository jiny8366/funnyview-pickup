import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin/admin-shell';
import { getCurrentUser } from '@/lib/auth/current-user';

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
