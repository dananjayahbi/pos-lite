import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { StockMovementHistory } from '@/components/stock-control/StockMovementHistory';

export const metadata = {
  title: 'Movement History | VelvetPOS',
};

export default async function MovementHistoryPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect('/login');

  const userPermissions = Array.isArray(session.user.permissions)
    ? session.user.permissions.filter((p): p is string => typeof p === 'string')
    : [];

  return <StockMovementHistory permissions={userPermissions} />;
}
