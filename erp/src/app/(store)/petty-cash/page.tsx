import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { denialRouteFor } from '@/lib/auth/page-guards';
import { resolvePettyCashPageAccess } from '@/lib/petty-cash/access';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import PettyCashDashboard from '@/components/petty-cash/PettyCashDashboard';

export const metadata = {
  title: 'Petty Cash',
};

/**
 * ARGUS #409 - the page is server-gated on `petty_cash:view`, matching its
 * APIs. A role without it is redirected before the shell renders; the client
 * receives the action flags so it cannot show buttons that would 403.
 */
export default async function PettyCashPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!session.user.tenantId) redirect(denialRouteFor(session.user));

  const access = resolvePettyCashPageAccess(session.user);
  if (!access.canView) {
    redirect('/dashboard');
  }

  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="space-y-4 p-6">
            <div className="h-8 w-48 animate-pulse rounded bg-mist" />
            <div className="h-28 w-full animate-pulse rounded bg-mist" />
          </div>
        }
      >
        <PettyCashDashboard
          canManage={access.canManage}
          canManageSettings={access.canManageSettings}
          canCreateExpense={access.canCreateExpense}
        />
      </Suspense>
    </ErrorBoundary>
  );
}
