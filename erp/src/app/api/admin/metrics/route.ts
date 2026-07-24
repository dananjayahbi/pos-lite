import { NextResponse } from 'next/server';
import Decimal from 'decimal.js';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();

  if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Active subscriptions with plan info
  const activeSubscriptions = await prisma.subscription.findMany({
    where: { status: 'ACTIVE' },
    include: { plan: true },
  });

  // MRR: sum of monthlyPrice for all ACTIVE subscriptions
  const mrr = activeSubscriptions.reduce(
    (sum, sub) => sum.plus(sub.plan.monthlyPrice),
    new Decimal(0),
  );
  const arr = mrr.times(12);

  const activeSubscribers = activeSubscriptions.length;

  const trialSubscribers = await prisma.subscription.count({
    where: { status: 'TRIAL' },
  });

  // Trial-to-paid in last 30 days: ACTIVE subs whose createdAt (or status change)
  // We approximate by checking ACTIVE subscriptions created in last 30 days
  // that have a trialEndsAt in the past (meaning they converted from trial)
  const trialToPaidLast30Days = await prisma.subscription.count({
    where: {
      status: 'ACTIVE',
      trialEndsAt: { not: null, lte: now },
      updatedAt: { gte: thirtyDaysAgo },
    },
  });

  // Churned in last 30 days
  const churnedLast30Days = await prisma.subscription.count({
    where: {
      status: 'CANCELLED',
      cancelledAt: { gte: thirtyDaysAgo },
    },
  });

  // Net churn rate: churned / (active + churned) * 100
  const totalBase = activeSubscribers + churnedLast30Days;
  const netChurnRate = totalBase > 0 ? (churnedLast30Days / totalBase) * 100 : 0;

  // Revenue by plan
  const plans = await prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    include: {
      subscriptions: {
        where: { status: 'ACTIVE' },
      },
    },
  });

  const revenueByPlan = plans.map((plan) => ({
    planName: plan.name,
    activeCount: plan.subscriptions.length,
    monthlyCumulativeRevenue: new Decimal(plan.monthlyPrice)
      .times(plan.subscriptions.length)
      .toNumber(),
  }));

  // Tenant list with subscription info
  const tenants = await prisma.tenant.findMany({
    include: {
      subscriptions: {
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      invoices: {
        where: { status: 'PAID' },
        orderBy: { paidAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const tenantList = tenants.map((tenant) => {
    const sub = tenant.subscriptions[0];
    const lastInvoice = tenant.invoices[0];

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      subscriptionStatus: tenant.subscriptionStatus,
      planName: sub?.plan.name ?? 'None',
      lastPaymentDate: lastInvoice?.paidAt?.toISOString() ?? null,
      nextBillingDate: sub?.currentPeriodEnd.toISOString() ?? null,
    };
  });

  return NextResponse.json({
    mrr: mrr.toNumber(),
    arr: arr.toNumber(),
    activeSubscribers,
    trialSubscribers,
    trialToPaidLast30Days,
    churnedLast30Days,
    netChurnRate: Math.round(netChurnRate * 100) / 100,
    revenueByPlan,
    tenants: tenantList,
  });
}
