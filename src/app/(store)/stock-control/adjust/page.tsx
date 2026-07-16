import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { StockAdjustmentForm } from '@/components/stock-control/StockAdjustmentForm';

export const metadata = {
  title: 'Stock Adjustment | VelvetPOS',
};

export default async function StockAdjustmentPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect('/login');

  const userPermissions = Array.isArray(session.user.permissions)
    ? session.user.permissions.filter((p): p is string => typeof p === 'string')
    : [];

  return <StockAdjustmentForm permissions={userPermissions} />;
}
