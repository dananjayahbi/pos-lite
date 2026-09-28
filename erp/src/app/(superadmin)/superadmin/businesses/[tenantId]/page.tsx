import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { getBusinessStats } from '@/lib/superadmin/business-stats';
import { formatLKR } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import TenantStatusBadge from '@/components/superadmin/TenantStatusBadge';
import BusinessMetricCards from '@/components/superadmin/BusinessMetricCards';
import BusinessCharts from '@/components/superadmin/BusinessCharts';

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-pearl border-mist h-24 animate-pulse rounded-xl border"
        />
      ))}
    </div>
  );
}

async function BusinessStatsContent({ tenantId }: { tenantId: string }) {
  const stats = await getBusinessStats(tenantId);

  if (!stats) {
    notFound();
  }

  const tenant = stats.tenant;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        {tenant.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tenant.logoUrl}
            alt={tenant.name}
            className="h-12 w-12 rounded-lg object-cover"
          />
        )}
        <div>
          <h1 className="font-display text-espresso text-2xl font-bold">{tenant.name}</h1>
          <p className="text-mist text-sm">
            {tenant.slug} · Since {new Date(tenant.createdAt).toLocaleDateString()}
          </p>
        </div>
        <TenantStatusBadge status={tenant.status} />
      </div>

      {/* About card */}
      <Card className="border-mist">
        <CardHeader>
          <CardTitle className="font-display text-espresso">Business Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-mist text-xs">Currency</p>
            <p className="text-espresso font-medium">{stats.settings.currency}</p>
          </div>
          <div>
            <p className="text-mist text-xs">Timezone</p>
            <p className="text-espresso font-medium">{stats.settings.timezone}</p>
          </div>
          <div>
            <p className="text-mist text-xs">VAT Rate</p>
            <p className="text-espresso font-medium">{stats.settings.vatRate}%</p>
          </div>
          <div>
            <p className="text-mist text-xs">SSCL Rate</p>
            <p className="text-espresso font-medium">{stats.settings.ssclRate}%</p>
          </div>
          <div>
            <p className="text-mist text-xs">Avg Sale (Month)</p>
            <p className="text-espresso font-medium">
              {stats.metrics.monthSales > 0
                ? formatLKR(stats.metrics.monthRevenue / stats.metrics.monthSales)
                : formatLKR(0)}
            </p>
          </div>
          <div>
            <p className="text-mist text-xs">Subscription</p>
            <p className="text-espresso font-medium">{tenant.subscriptionStatus}</p>
          </div>
        </CardContent>
      </Card>

      {/* Metric cards */}
      <section className="space-y-4">
        <h2 className="font-display text-espresso text-xl font-semibold">
          Live Statistics
        </h2>
        <BusinessMetricCards metrics={stats.metrics} />
      </section>

      {/* Charts */}
      <section className="space-y-4">
        <h2 className="font-display text-espresso text-xl font-semibold">
          Sales Analytics
        </h2>
        <BusinessCharts charts={stats.charts} />
      </section>
    </div>
  );
}

export default async function BusinessDetailPage({ params }: PageProps) {
  const { tenantId } = await params;

  // Validate the tenant exists to prevent broken dynamic nav links.
  const exists = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true },
  });

  if (!exists) {
    notFound();
  }

  return (
    <main className="p-8">
      <Link
        href="/superadmin/tenants"
        className="text-espresso/70 hover:text-espresso mb-6 inline-block text-sm transition-colors"
      >
        ← Back to Businesses
      </Link>

      <Suspense fallback={<StatsSkeleton />}>
        <BusinessStatsContent tenantId={tenantId} />
      </Suspense>
    </main>
  );
}
