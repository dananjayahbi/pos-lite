import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { denialRouteFor, requirePagePermission } from '@/lib/auth/page-guards';
import { redirect } from 'next/navigation';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PaymentAccountsPageClient } from '@/components/payment-accounts/PaymentAccountsPageClient';

export const metadata = {
  title: 'Payment Accounts | AyurPOS',
};

export default async function PaymentAccountsPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect(denialRouteFor(session?.user));

  requirePagePermission(session.user, PERMISSIONS.PAYMENT_ACCOUNT.viewPaymentAccount);

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
        <PaymentAccountsPageClient />
      </Suspense>
    </ErrorBoundary>
  );
}
