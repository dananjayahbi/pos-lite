import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { MetricCard } from "@/components/superadmin/MetricCard";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Store, TrendingUp, AlertTriangle, Calendar } from "lucide-react";
import Link from "next/link";

const lkr = new Intl.NumberFormat("en-LK", {
  style: "currency",
  currency: "LKR",
});

function MetricsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="bg-pearl border-sand h-24 animate-pulse rounded-xl border"
        />
      ))}
    </div>
  );
}

function PanelsSkeleton() {
  return (
    <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <div
          key={i}
          className="bg-pearl border-sand h-64 animate-pulse rounded-xl border"
        />
      ))}
    </div>
  );
}

async function DashboardMetrics() {
  const now = new Date();
  const sevenDaysLater = new Date(now);
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

  const [activeTenants, activeSubscriptions, gracePeriod, upcomingRenewals] =
    await Promise.all([
      prisma.tenant.count({ where: { status: "ACTIVE", deletedAt: null } }),
      prisma.subscription.findMany({
        where: { status: "ACTIVE" },
        include: { plan: { select: { monthlyPrice: true } } },
      }),
      prisma.tenant.count({
        where: { status: "GRACE_PERIOD", deletedAt: null },
      }),
      prisma.subscription.count({
        where: {
          currentPeriodEnd: { gte: now, lte: sevenDaysLater },
          status: { not: "CANCELLED" },
        },
      }),
    ]);

  const mrrValue = activeSubscriptions.reduce(
    (sum, sub) => sum + Number(sub.plan.monthlyPrice),
    0,
  );

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label="Total Active Tenants"
        value={activeTenants}
        icon={<Store className="h-6 w-6" />}
      />
      <MetricCard
        label="Monthly Recurring Revenue"
        value={lkr.format(mrrValue)}
        icon={<TrendingUp className="h-6 w-6" />}
      />
      <MetricCard
        label="Tenants in Grace Period"
        value={gracePeriod}
        icon={<AlertTriangle className="h-6 w-6" />}
      />
      <MetricCard
        label="Upcoming Renewals"
        value={upcomingRenewals}
        icon={<Calendar className="h-6 w-6" />}
      />
    </div>
  );
}

async function DashboardPanels() {
  const now = new Date();

  const [recentTenants, upcomingRenewals] = await Promise.all([
    prisma.tenant.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        subscriptions: {
          take: 1,
          orderBy: { createdAt: "desc" },
          include: { plan: true },
        },
      },
    }),
    prisma.subscription.findMany({
      where: { status: "ACTIVE", currentPeriodEnd: { gt: now } },
      orderBy: { currentPeriodEnd: "asc" },
      take: 5,
      include: { tenant: true, plan: true },
    }),
  ]);

  return (
    <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Recent Sign-Ups */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Sign-Ups</CardTitle>
        </CardHeader>
        <CardContent>
          {recentTenants.length === 0 ? (
            <p className="text-mist text-sm">No tenants yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store Name</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell>
                      <Link
                        href={`/superadmin/tenants/${tenant.id}`}
                        className="text-espresso hover:underline"
                      >
                        {tenant.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {tenant.subscriptions[0]?.plan.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      {tenant.createdAt.toLocaleDateString("en-LK")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Renewals */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Renewals</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingRenewals.length === 0 ? (
            <p className="text-mist text-sm">
              No renewals in the next 7 days.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store Name</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Renewal Date</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingRenewals.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell>
                      <Link
                        href={`/superadmin/tenants/${sub.tenant.id}`}
                        className="text-espresso hover:underline"
                      >
                        {sub.tenant.name}
                      </Link>
                    </TableCell>
                    <TableCell>{sub.plan.name}</TableCell>
                    <TableCell>
                      {sub.currentPeriodEnd.toLocaleDateString("en-LK")}
                    </TableCell>
                    <TableCell>
                      {lkr.format(Number(sub.plan.monthlyPrice))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SuperAdminDashboardPage() {
  return (
    <main className="p-8">
      <h1 className="font-display text-espresso mb-6 text-2xl font-bold">
        Dashboard
      </h1>

      <Suspense fallback={<MetricsSkeleton />}>
        <DashboardMetrics />
      </Suspense>

      <Suspense fallback={<PanelsSkeleton />}>
        <DashboardPanels />
      </Suspense>
    </main>
  );
}
