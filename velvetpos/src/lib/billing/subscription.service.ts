import { prisma } from '@/lib/prisma';
import { type Prisma, SubscriptionStatus } from '@/generated/prisma/client';

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
    const trialEndsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

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
