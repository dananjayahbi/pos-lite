import Link from 'next/link';
import { SubscriptionStatus } from '@/generated/prisma/client';
import { Button } from '@/components/ui/button';

interface TrialBannerSubscription {
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  tenant: { slug: string };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export default function TrialBanner({
  subscription,
}: {
  subscription: TrialBannerSubscription;
}) {
  const { status, trialEndsAt, tenant } = subscription;

  if (status !== SubscriptionStatus.TRIAL && status !== SubscriptionStatus.PAST_DUE) {
    return null;
  }

  const billingHref = `/${tenant.slug}/billing`;

  if (status === SubscriptionStatus.PAST_DUE) {
    return (
      <div className="flex w-full items-center justify-center gap-3 bg-terracotta px-4 py-2.5 text-white">
        <p className="text-sm font-medium">
          Your subscription payment is overdue. Please renew to avoid service interruption.
        </p>
        <Button variant="outline" size="sm" className="border-white text-white hover:bg-white/20" asChild>
          <Link href={billingHref}>Renew Now</Link>
        </Button>
      </div>
    );
  }

  // TRIAL status
  const daysRemaining = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / DAY_MS))
    : 0;

  let bgClass: string;
  let textClass: string;
  let message: string;

  if (daysRemaining === 0) {
    bgClass = 'bg-espresso';
    textClass = 'text-pearl';
    message = 'Your trial has ended. Subscribe now to continue using VelvetPOS.';
  } else if (daysRemaining <= 7) {
    bgClass = 'bg-terracotta';
    textClass = 'text-white';
    message = `Your trial ends in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}. Subscribe now to keep your data.`;
  } else {
    bgClass = 'bg-sand';
    textClass = 'text-espresso';
    message = `You have ${daysRemaining} days left in your free trial.`;
  }

  return (
    <div className={`flex w-full items-center justify-center gap-3 px-4 py-2.5 ${bgClass} ${textClass}`}>
      <p className="text-sm font-medium">{message}</p>
      <Button variant="outline" size="sm" className="border-current hover:bg-white/20" asChild>
        <Link href={billingHref}>Subscribe Now</Link>
      </Button>
    </div>
  );
}
