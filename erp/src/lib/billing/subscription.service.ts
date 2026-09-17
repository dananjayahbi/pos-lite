import { prisma } from '@/lib/prisma';
import { type Prisma, SubscriptionStatus } from '@/generated/prisma/client';
import { TRIAL_PERIOD_DAYS } from '@/lib/billing/constants';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function createTrialSubscription(
  tenantId: string,
  planId: string,
  tx?: Prisma.TransactionClient,
) {
  const run = async (client: Prisma.TransactionClient) => {
    const plan = await client.subscriptionPlan.findUnique({
      where: { id: planId },
    });
    if (!plan || !plan.isActive) {
      throw new Error('Plan not found or inactive');
    }

    const now = new Date();
    // Trial length is TRIAL_PERIOD_DAYS (30) — named in lib/billing/constants
    // so the seed's demo-trial block (M30-01) uses the identical basis.
    const trialEndsAt = new Date(
      now.getTime() + TRIAL_PERIOD_DAYS * MS_PER_DAY,
    );

    const subscription = await client.subscription.create({
      data: {
        tenantId,
        planId,
        status: SubscriptionStatus.TRIAL,
        trialEndsAt,
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt,
      },
    });

    await client.tenant.update({
      where: { id: tenantId },
      data: { subscriptionStatus: SubscriptionStatus.TRIAL },
    });

    return subscription;
  };

  if (tx) {
    return run(tx);
  }
  return prisma.$transaction(run);
}

export async function getSubscriptionForTenant(tenantId: string) {
  return prisma.subscription.findUnique({
    where: { tenantId },
    include: {
      plan: true,
      tenant: { select: { slug: true } },
      invoices: {
        orderBy: { createdAt: 'desc' },
        take: 3,
      },
    },
  });
}
