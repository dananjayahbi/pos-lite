import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import PlansClient from '@/components/super-admin/PlansClient';

export default async function SuperAdminPlansPage() {
  const session = await auth();

  if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
    redirect('/auth/login');
  }

  const plans = await prisma.subscriptionPlan.findMany({
    orderBy: { monthlyPrice: 'asc' },
    include: { _count: { select: { subscriptions: true } } },
  });

  // Serialize Decimal fields to numbers for client component
  const serializedPlans = plans.map((plan) => ({
    ...plan,
    monthlyPrice: Number(plan.monthlyPrice),
    annualPrice: Number(plan.annualPrice),
  }));

  return (
    <main className="mx-auto max-w-6xl p-6 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-espresso">Subscription Plans</h1>
        <p className="mt-1 text-sm text-mist">
          Manage subscription tiers, pricing, and feature limits.
        </p>
      </div>
      <PlansClient initialPlans={serializedPlans} />
    </main>
  );
}
