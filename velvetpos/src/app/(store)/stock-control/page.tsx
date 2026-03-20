import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { StockControlDashboard } from '@/components/stock-control/StockControlDashboard';

export const metadata = {
  title: 'Stock Control | VelvetPOS',
};

export default async function StockControlPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect('/login');

  const userPermissions = Array.isArray(session.user.permissions)
    ? session.user.permissions.filter((p): p is string => typeof p === 'string')
    : [];

  return <StockControlDashboard permissions={userPermissions} />;
}
