import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { denialRouteFor, requirePagePermission } from '@/lib/auth/page-guards';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getSubscriptionForTenant } from '@/lib/billing/subscription.service';
import PaymentMethodManagementCard from '@/components/billing/PaymentMethodManagementCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'Payment Methods | AyurPOS' };

export default async function BillingPaymentMethodsPage() {
  const session = await auth();
  if (!session?.user?.id || !session.user.tenantId) {
    redirect(denialRouteFor(session?.user));
  }

  // XC-03: the previous inline `['OWNER','MANAGER','SUPER_ADMIN'].includes(...)`
  // duplicated a role list that ROLE_PERMISSIONS already owns (and drifted:
  // SUPER_ADMIN can never reach a tenant store page anyway). The shared guard
  // expresses the same intent as one key — MANAGER deliberately does NOT hold
  // `manageBilling` (it is in managerExcluded), so this preserves the intended
  // owner-only billing posture while letting the registry stay authoritative.
  requirePagePermission(session.user, PERMISSIONS.BILLING.manageBilling);

  const subscription = await getSubscriptionForTenant(session.user.tenantId);
  if (!subscription) {
    redirect('/billing');
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-espresso">Payment Methods</h1>
        <p className="mt-1 text-sm text-sand">
          Manage the hosted billing method workflow currently supported for your subscription.
        </p>
      </div>

      <PaymentMethodManagementCard
        tenantId={session.user.tenantId}
        planId={subscription.planId}
        hasSavedBillingToken={Boolean(subscription.payhereSubscriptionToken)}
        subscriptionStatus={subscription.status}
      />

      <Card className="border-mist">
        <CardHeader>
          <CardTitle className="text-espresso">What’s supported today</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-sand">
          <p>• Card details stay inside PayHere’s hosted checkout flow.</p>
          <p>• AyurPOS can show whether a recurring billing token exists, but not raw card numbers or brand details.</p>
          <p>• To replace a billing card, run a fresh hosted checkout from this page or the main billing dashboard.</p>
        </CardContent>
      </Card>
    </div>
  );
}
