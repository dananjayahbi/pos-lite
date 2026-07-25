import { redirect } from 'next/navigation';
import Decimal from 'decimal.js';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import MetricsStatCards from '@/components/super-admin/MetricsStatCards';
import MetricsCharts from '@/components/super-admin/MetricsCharts';
import TenantMetricsTable from '@/components/super-admin/TenantMetricsTable';

export default async function SuperAdminMetricsPage() {
  const session = await auth();

  if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
    redirect('/auth/login');
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const activeSubscriptions = await prisma.subscription.findMany({
    where: { status: 'ACTIVE' },
    include: { plan: true },
  });

  const mrr = activeSubscriptions
    .reduce((sum, sub) => sum.plus(sub.plan.monthlyPrice), new Decimal(0))
    .toNumber();
  const arr = mrr * 12;

  const activeSubscribers = activeSubscriptions.length;

  const trialSubscribers = await prisma.subscription.count({
    where: { status: 'TRIAL' },
  });

  const trialToPaidLast30Days = await prisma.subscription.count({
    where: {
      status: 'ACTIVE',
      trialEndsAt: { not: null, lte: now },
      updatedAt: { gte: thirtyDaysAgo },
    },
  });

  const churnedLast30Days = await prisma.subscription.count({
    where: {
      status: 'CANCELLED',
      cancelledAt: { gte: thirtyDaysAgo },
    },
  });

  const totalBase = activeSubscribers + churnedLast30Days;
  const netChurnRate = totalBase > 0 ? Math.round((churnedLast30Days / totalBase) * 10000) / 100 : 0;

  const trialConversionRate =
    trialSubscribers + trialToPaidLast30Days > 0
      ? Math.round((trialToPaidLast30Days / (trialSubscribers + trialToPaidLast30Days)) * 10000) / 100
      : 0;

  // Revenue by plan
  const plans = await prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    include: {
      subscriptions: { where: { status: 'ACTIVE' } },
    },
  });

  const revenueByPlan = plans.map((plan) => ({
    planName: plan.name,
    activeCount: plan.subscriptions.length,
    monthlyCumulativeRevenue: new Decimal(plan.monthlyPrice)
      .times(plan.subscriptions.length)
      .toNumber(),
  }));

  // Tenants
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

  const timestamp = now.toLocaleDateString('en-LK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <main className="mx-auto max-w-7xl p-6 md:p-8">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-espresso">Business Metrics</h1>
        <p className="mt-1 text-sm text-mist">Last updated: {timestamp}</p>
      </div>

      <MetricsStatCards
        mrr={mrr}
        arr={arr}
        activeSubscribers={activeSubscribers}
        trialSubscribers={trialSubscribers}
        trialConversionRate={trialConversionRate}
        churnedLast30Days={churnedLast30Days}
        netChurnRate={netChurnRate}
      />

      <div className="mt-8">
        <MetricsCharts revenueByPlan={revenueByPlan} />
      </div>

      <div className="mt-8">
        <TenantMetricsTable tenants={tenantList} />
      </div>
    </main>
  );
}
