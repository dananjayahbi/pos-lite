import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { LowStockList } from '@/components/stock-control/LowStockList';

export const metadata = {
  title: 'Low Stock | VelvetPOS',
};

export default async function LowStockPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect('/login');

  const userPermissions = Array.isArray(session.user.permissions)
    ? session.user.permissions.filter((p): p is string => typeof p === 'string')
    : [];

  return <LowStockList permissions={userPermissions} />;
}
