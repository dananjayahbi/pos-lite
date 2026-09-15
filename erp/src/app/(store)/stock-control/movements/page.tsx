import { auth } from '@/lib/auth';
import { denialRouteFor } from '@/lib/auth/page-guards';
import { redirect } from 'next/navigation';
import { StockMovementHistory } from '@/components/stock-control/StockMovementHistory';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export const metadata = {
  title: 'Movement History | AyurPOS',
};

export default async function MovementHistoryPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect(denialRouteFor(session?.user));

  const userPermissions = Array.isArray(session.user.permissions)
    ? session.user.permissions.filter((p): p is string => typeof p === 'string')
    : [];

  return (
    <ErrorBoundary>
      <StockMovementHistory permissions={userPermissions} />
    </ErrorBoundary>
  );
}
