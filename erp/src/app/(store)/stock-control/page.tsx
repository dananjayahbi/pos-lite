import { auth } from '@/lib/auth';
import { denialRouteFor } from '@/lib/auth/page-guards';
import { redirect } from 'next/navigation';
import { StockControlDashboard } from '@/components/stock-control/StockControlDashboard';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export const metadata = {
  title: 'Stock Control | AyurPOS',
};

export default async function StockControlPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect(denialRouteFor(session?.user));

  const userPermissions = Array.isArray(session.user.permissions)
    ? session.user.permissions.filter((p): p is string => typeof p === 'string')
    : [];

  return (
    <ErrorBoundary>
      <StockControlDashboard permissions={userPermissions} />
    </ErrorBoundary>
  );
}
