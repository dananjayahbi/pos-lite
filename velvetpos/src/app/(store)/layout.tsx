// Shell placeholder — the AppSidebar and main content area will be integrated
// in SubPhase 02.xx when the navigation components are built.
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { SubscriptionStatus } from '@/generated/prisma/client';
import { getSubscriptionForTenant } from '@/lib/billing/subscription.service';
import StoreLayoutClient from '@/components/shared/StoreLayoutClient';
import GracePeriodBanner from '@/components/shared/GracePeriodBanner';
import TrialBanner from '@/components/layout/TrialBanner';

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const isGracePeriod = headersList.get('x-grace-period') === 'true';
  const graceEndsAt = headersList.get('x-grace-ends-at');

  const session = await auth();
  const tenantId = session?.user?.tenantId;

  let subscription: Awaited<ReturnType<typeof getSubscriptionForTenant>> = null;
  if (tenantId) {
    subscription = await getSubscriptionForTenant(tenantId);
  }

  const showTrialBanner =
    subscription &&
    (subscription.status === SubscriptionStatus.TRIAL ||
      subscription.status === SubscriptionStatus.PAST_DUE);

  return (
    <div className="min-h-screen flex flex-col bg-linen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-espresso focus:px-4 focus:py-2 focus:text-pearl focus:outline-none"
      >
        Skip to main content
      </a>
      <GracePeriodBanner visible={isGracePeriod} graceEndsAt={graceEndsAt} />
      {showTrialBanner && subscription && <TrialBanner subscription={subscription} />}
      <div className="flex flex-1">
        <main id="main-content" className="flex-1">
          <StoreLayoutClient>{children}</StoreLayoutClient>
        </main>
      </div>
    </div>
  );
}
