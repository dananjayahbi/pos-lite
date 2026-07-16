import Link from 'next/link';
import { CreditCard, ExternalLink, RefreshCcw, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import PayHereCheckoutButton from '@/components/billing/PayHereCheckoutButton';

interface PaymentMethodManagementCardProps {
  tenantId: string;
  planId: string;
  hasSavedBillingToken: boolean;
  subscriptionStatus: string;
}

export default function PaymentMethodManagementCard({
  tenantId,
  planId,
  hasSavedBillingToken,
  subscriptionStatus,
}: PaymentMethodManagementCardProps) {
  const canRefresh = ['ACTIVE', 'TRIAL', 'PAST_DUE', 'SUSPENDED', 'CANCELLED'].includes(subscriptionStatus);

  return (
    <Card className="border-mist">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-espresso">Payment Method Management</CardTitle>
            <CardDescription>
              VelvetPOS keeps card collection inside PayHere’s hosted flow so card data never touches your store app.
            </CardDescription>
          </div>
          <Badge variant="outline" className={hasSavedBillingToken ? 'border-green-300 text-green-700' : 'border-amber-300 text-amber-700'}>
            {hasSavedBillingToken ? 'Token on file' : 'No token on file'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-mist bg-pearl/50 p-4">
            <div className="flex items-center gap-2 text-espresso">
              <ShieldCheck className="h-4 w-4 text-terracotta" />
              <p className="font-medium">Hosted checkout only</p>
            </div>
            <p className="mt-2 text-sm text-sand">
              Card updates happen through PayHere checkout for PCI-safe billing method changes.
            </p>
          </div>
          <div className="rounded-lg border border-mist bg-pearl/50 p-4">
            <div className="flex items-center gap-2 text-espresso">
              <CreditCard className="h-4 w-4 text-terracotta" />
              <p className="font-medium">Current billing token</p>
            </div>
            <p className="mt-2 text-sm text-sand">
              {hasSavedBillingToken
                ? 'A recurring billing token is currently attached to this subscription.'
                : 'No recurring token is attached yet. Completing checkout will create or refresh it.'}
            </p>
          </div>
          <div className="rounded-lg border border-mist bg-pearl/50 p-4">
            <div className="flex items-center gap-2 text-espresso">
              <RefreshCcw className="h-4 w-4 text-terracotta" />
              <p className="font-medium">Change the card</p>
            </div>
            <p className="mt-2 text-sm text-sand">
              Re-run hosted checkout to refresh the payment method tied to the subscription.
            </p>
          </div>
        </div>

        {canRefresh && (
          <div className="grid gap-3 md:grid-cols-2">
            <PayHereCheckoutButton
              tenantId={tenantId}
              planId={planId}
              billingCycle="monthly"
              buttonLabel="Refresh Payment Method — Monthly"
            />
            <PayHereCheckoutButton
              tenantId={tenantId}
              planId={planId}
              billingCycle="annual"
              buttonLabel="Refresh Payment Method — Annual"
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/billing/payment-methods">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open payment-methods view
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
