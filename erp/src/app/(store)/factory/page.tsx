import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS, getEffectivePermissions } from '@/lib/constants/permissions';
import { FactoryDashboardClient } from '@/components/raw-materials/FactoryDashboardClient';

export const metadata = {
  title: 'Factory Dashboard | AyurPOS',
};

export default async function FactoryDashboardPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect('/login');

  if (!hasPermission(session.user, PERMISSIONS.FACTORY.viewFactoryDashboard)) {
    redirect('/dashboard');
  }

  const permissions = getEffectivePermissions(session.user.role, session.user.permissions);

  return <FactoryDashboardClient permissions={permissions} />;
}
