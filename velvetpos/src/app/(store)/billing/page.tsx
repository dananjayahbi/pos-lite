import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SubscriptionStatus } from "@/generated/prisma/client";
import { getSubscriptionForTenant } from "@/lib/billing/subscription.service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import PayHereCheckoutButton from "@/components/billing/PayHereCheckoutButton";
import BillingPageToast from "@/components/billing/BillingPageToast";
import SubscriptionOverviewCard from "@/components/billing/SubscriptionOverviewCard";
import InvoiceHistoryTable from "@/components/billing/InvoiceHistoryTable";
import CancelSubscriptionButton from "@/components/billing/CancelSubscriptionButton";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (!session?.user?.id || !session.user.tenantId) {
    redirect("/login");
  }

  const role = session.user.role;
  if (role !== "OWNER" && role !== "MANAGER" && role !== "SUPER_ADMIN") {
    redirect("/");
  }

  const tenantId = session.user.tenantId;
  const subscription = await getSubscriptionForTenant(tenantId);

  if (!subscription) {
    redirect("/");
  }

  const params = await searchParams;
  const statusParam =
    typeof params.status === "string" ? params.status : undefined;

  let toastMessage: string | undefined;
  let toastType: "success" | "cancel" | undefined;

  if (statusParam === "success") {
    toastMessage =
      "Payment submitted! Your subscription will be activated shortly.";
    toastType = "success";
  } else if (statusParam === "cancelled") {
    toastMessage = "Payment was cancelled.";
    toastType = "cancel";
  }

  const trialDaysRemaining = subscription.trialEndsAt
    ? Math.max(
        0,
        Math.ceil(
          (subscription.trialEndsAt.getTime() - Date.now()) /
            (1000 * 60 * 60 * 24),
        ),
      )
    : 0;

  const status = subscription.status;
  const isOwner = role === "OWNER";
  const showPayment =
    status === SubscriptionStatus.TRIAL ||
    status === SubscriptionStatus.PAST_DUE ||
    status === SubscriptionStatus.SUSPENDED ||
    status === SubscriptionStatus.CANCELLED;
  const showCancel =
    isOwner &&
    (status === SubscriptionStatus.ACTIVE ||
      status === SubscriptionStatus.TRIAL);

  const invoiceRows = subscription.invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    billingPeriodStart: inv.billingPeriodStart.toISOString(),
    billingPeriodEnd: inv.billingPeriodEnd.toISOString(),
    amount: inv.amount.toString(),
    currency: inv.currency,
    status: inv.status as "PENDING" | "PAID" | "FAILED" | "VOIDED",
  }));

  return (
    <div className="space-y-6 p-6">
      <BillingPageToast message={toastMessage} type={toastType} />

      <div>
        <h1 className="text-2xl font-bold text-espresso">Billing</h1>
        <p className="text-mist-foreground/70">
          Manage your subscription and payments
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left column: Overview + Actions ── */}
        <div className="space-y-6 lg:col-span-1">
          <SubscriptionOverviewCard
            planName={subscription.plan.name}
            status={status}
            monthlyAmount={subscription.plan.monthlyPrice.toString()}
            currency="LKR"
            currentPeriodEnd={subscription.currentPeriodEnd.toISOString()}
            trialEndsAt={subscription.trialEndsAt?.toISOString()}
          />

          {/* Trial upgrade card */}
          {status === SubscriptionStatus.TRIAL && (
            <Card className="border-terracotta/30">
              <CardHeader>
                <CardTitle className="text-espresso">
                  Upgrade Your Plan
                </CardTitle>
                <CardDescription>
                  {trialDaysRemaining > 0
                    ? `${trialDaysRemaining} day${trialDaysRemaining !== 1 ? "s" : ""} remaining in your trial.`
                    : "Your trial has expired."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-mist-foreground/70">
                  Subscribe now to continue using VelvetPOS.
                </p>
                <div className="flex flex-col gap-3">
                  <PayHereCheckoutButton
                    tenantId={tenantId}
                    planId={subscription.planId}
                    billingCycle="monthly"
                    buttonLabel={`Monthly — LKR ${subscription.plan.monthlyPrice}`}
                  />
                  <PayHereCheckoutButton
                    tenantId={tenantId}
                    planId={subscription.planId}
                    billingCycle="annual"
                    buttonLabel={`Annual — LKR ${subscription.plan.annualPrice}`}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Past due payment card */}
          {status === SubscriptionStatus.PAST_DUE && (
            <Card className="border-terracotta/30">
              <CardHeader>
                <CardTitle className="text-espresso">
                  Resolve Payment
                </CardTitle>
                <CardDescription>
                  Pay now to keep your subscription active.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PayHereCheckoutButton
                  tenantId={tenantId}
                  planId={subscription.planId}
                  billingCycle="monthly"
                  buttonLabel="Pay Now"
                />
              </CardContent>
            </Card>
          )}

          {/* Suspended renewal card */}
          {status === SubscriptionStatus.SUSPENDED && (
            <Card className="border-espresso/20">
              <CardHeader>
                <CardTitle className="text-espresso">
                  Renew Subscription
                </CardTitle>
                <CardDescription>
                  Renew to restore access to VelvetPOS.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PayHereCheckoutButton
                  tenantId={tenantId}
                  planId={subscription.planId}
                  billingCycle="monthly"
                  buttonLabel="Renew Subscription"
                />
              </CardContent>
            </Card>
          )}

          {/* Cancelled reactivation card */}
          {status === SubscriptionStatus.CANCELLED && (
            <Card className="border-mist">
              <CardHeader>
                <CardTitle className="text-espresso">Reactivate</CardTitle>
                <CardDescription>
                  Your subscription was cancelled
                  {subscription.cancelledAt
                    ? ` on ${subscription.cancelledAt.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}`
                    : ""}
                  .
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <PayHereCheckoutButton
                  tenantId={tenantId}
                  planId={subscription.planId}
                  billingCycle="monthly"
                  buttonLabel="Reactivate — Monthly"
                />
                <PayHereCheckoutButton
                  tenantId={tenantId}
                  planId={subscription.planId}
                  billingCycle="annual"
                  buttonLabel="Reactivate — Annual"
                />
              </CardContent>
            </Card>
          )}

          {showCancel && (
            <CancelSubscriptionButton tenantId={tenantId} />
          )}
        </div>

        {/* ── Right column: Invoice History ── */}
        <div className="space-y-4 lg:col-span-2">
          <h2 className="text-lg font-semibold text-espresso">
            Invoice History
          </h2>
          <InvoiceHistoryTable invoices={invoiceRows} />
        </div>
      </div>
    </div>
  );
}
