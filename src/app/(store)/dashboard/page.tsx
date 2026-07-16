import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDefaultRouteForRole } from "@/lib/utils/default-route";
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
import { Badge } from "@/components/ui/badge";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { ShoppingBag, TrendingUp, AlertTriangle, Users } from "lucide-react";
import { StockSummaryWidgets } from "@/components/dashboard/StockSummaryWidgets";
import { RecentStockMovementsCard } from "@/components/dashboard/RecentStockMovementsCard";

const lkr = new Intl.NumberFormat("en-LK", {
  style: "currency",
  currency: "LKR",
});

function StatCard({
  label,
  value,
  icon,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between pt-6">
        <div>
          <p className="text-sm text-sand">{label}</p>
          <p className="mt-1 text-2xl font-bold text-espresso">{value}</p>
          {sub && <p className="mt-1 text-xs text-mist">{sub}</p>}
        </div>
        <div className="rounded-lg bg-linen p-2 text-terracotta">{icon}</div>
      </CardContent>
    </Card>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-28 animate-pulse rounded-xl border border-mist bg-pearl"
        />
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2 px-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-md bg-linen" />
      ))}
    </div>
  );
}

function QuickAccessCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link href={href} className="block transition-transform hover:-translate-y-0.5">
      <Card className="h-full border-mist bg-pearl transition-colors hover:border-terracotta/40">
        <CardContent className="flex h-full flex-col justify-between gap-3 pt-6">
          <div>
            <h3 className="font-semibold text-espresso">{title}</h3>
            <p className="mt-1 text-sm text-sand">{description}</p>
          </div>
          <span className="text-sm font-medium text-terracotta">Open →</span>
        </CardContent>
      </Card>
    </Link>
  );
}

async function TodayStats({ tenantId }: { tenantId: string }) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [todaySales, totalCustomers, lowStockResult, openShift] =
    await Promise.all([
      prisma.sale.findMany({
        where: {
          tenantId,
          status: "COMPLETED",
          completedAt: { gte: todayStart },
        },
        select: { totalAmount: true },
      }),
      prisma.customer.count({
        where: { tenantId, isActive: true, deletedAt: null },
      }),
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count
        FROM "product_variants" pv
        JOIN "products" p ON pv."productId" = p."id"
        WHERE pv."tenantId" = ${tenantId}
          AND pv."deletedAt" IS NULL
          AND p."isArchived" = false
          AND p."deletedAt" IS NULL
          AND pv."stockQuantity" <= pv."lowStockThreshold"
      `,
      prisma.shift.findFirst({
        where: { tenantId, status: "OPEN" },
        select: {
          id: true,
          openedAt: true,
          cashier: { select: { email: true } },
        },
        orderBy: { openedAt: "desc" },
      }),
    ]);

  const todayRevenue = todaySales.reduce(
    (sum, s) => sum + Number(s.totalAmount),
    0,
  );
  const lowStockCount = Number(lowStockResult[0]?.count ?? 0);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Today's Revenue"
        value={lkr.format(todayRevenue)}
        icon={<TrendingUp className="h-5 w-5" />}
        sub={`${todaySales.length} transaction${todaySales.length !== 1 ? "s" : ""}`}
      />
      <StatCard
        label="Today's Sales"
        value={todaySales.length}
        icon={<ShoppingBag className="h-5 w-5" />}
        sub="Completed today"
      />
      <StatCard
        label="Active Customers"
        value={totalCustomers.toLocaleString()}
        icon={<Users className="h-5 w-5" />}
        sub="All time"
      />
      <StatCard
        label="Low Stock Alerts"
        value={lowStockCount}
        icon={<AlertTriangle className="h-5 w-5" />}
        sub={
          openShift
            ? `Shift open · ${openShift.openedAt.toLocaleTimeString("en-LK", {
                hour: "2-digit",
                minute: "2-digit",
              })}`
            : "No open shift"
        }
      />
    </div>
  );
}

async function RecentSales({ tenantId }: { tenantId: string }) {
  const sales = await prisma.sale.findMany({
    where: { tenantId, status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    take: 8,
    select: {
      id: true,
      totalAmount: true,
      paymentMethod: true,
      completedAt: true,
      customer: { select: { name: true } },
      _count: { select: { lines: true } },
    },
  });

  if (sales.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-sand">
        No sales recorded yet.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Customer</TableHead>
          <TableHead>Items</TableHead>
          <TableHead>Payment</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sales.map((sale) => (
          <TableRow key={sale.id}>
            <TableCell className="text-espresso">
              {sale.customer?.name ?? "Walk-in"}
            </TableCell>
            <TableCell>{sale._count.lines}</TableCell>
            <TableCell>
              <Badge
                className={
                  sale.paymentMethod === "CASH"
                    ? "bg-green-100 text-green-800"
                    : sale.paymentMethod === "CARD"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-purple-100 text-purple-800"
                }
              >
                {sale.paymentMethod ?? "—"}
              </Badge>
            </TableCell>
            <TableCell className="font-medium text-espresso">
              {lkr.format(Number(sale.totalAmount))}
            </TableCell>
            <TableCell className="text-sm text-sand">
              {sale.completedAt
                ? new Date(sale.completedAt).toLocaleTimeString("en-LK", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

type LowStockRow = {
  id: string;
  sku: string;
  size: string | null;
  colour: string | null;
  stockQuantity: number;
  lowStockThreshold: number;
  productId: string;
  productName: string;
};

async function LowStockItems({ tenantId }: { tenantId: string }) {
  const rows = await prisma.$queryRaw<LowStockRow[]>`
    SELECT
      pv."id",
      pv."sku",
      pv."size",
      pv."colour",
      pv."stockQuantity",
      pv."lowStockThreshold",
      pv."productId",
      p."name" AS "productName"
    FROM "product_variants" pv
    JOIN "products" p ON pv."productId" = p."id"
    WHERE pv."tenantId" = ${tenantId}
      AND pv."deletedAt" IS NULL
      AND p."isArchived" = false
      AND p."deletedAt" IS NULL
      AND pv."stockQuantity" <= pv."lowStockThreshold"
    ORDER BY pv."stockQuantity" ASC
    LIMIT 8
  `;

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-sand">
        All stock levels are healthy.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Product</TableHead>
          <TableHead>SKU</TableHead>
          <TableHead>In Stock</TableHead>
          <TableHead>Min</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((v) => (
          <TableRow key={v.id}>
            <TableCell className="font-medium text-espresso">
              {v.productName}
              {(v.size ?? v.colour) && (
                <span className="ml-1 text-xs text-sand">
                  {[v.size, v.colour].filter(Boolean).join(" / ")}
                </span>
              )}
            </TableCell>
            <TableCell className="font-mono text-sm">{v.sku}</TableCell>
            <TableCell>
              <span
                className={
                  v.stockQuantity === 0
                    ? "font-semibold text-red-600"
                    : "font-semibold text-amber-600"
                }
              >
                {v.stockQuantity}
              </span>
            </TableCell>
            <TableCell className="text-sand">{v.lowStockThreshold}</TableCell>
            <TableCell>
              <Link
                href={`/inventory/${v.productId}`}
                className="text-sm text-terracotta hover:underline"
              >
                View
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default async function StoreDashboardPage() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  const defaultRoute = getDefaultRouteForRole(session.user.role);
  if (defaultRoute !== '/dashboard') {
    redirect(defaultRoute);
  }

  const { tenantId } = session.user;
  const permissions = Array.isArray(session.user.permissions)
    ? session.user.permissions.filter((permission): permission is string => typeof permission === 'string')
    : [];
  const quickLinks = [
    {
      title: 'Sales History',
      description: 'Review completed sales outside the POS terminal.',
      href: '/sales',
      permission: PERMISSIONS.SALE.viewSale,
    },
    {
      title: 'Returns',
      description: 'Review refunds, exchanges, and restocking outcomes.',
      href: '/returns',
      permission: PERMISSIONS.SALE.viewSale,
    },
    {
      title: 'Shifts',
      description: 'Manage open tills, close shifts, and open Z-style reports.',
      href: '/staff/shifts',
      permission: PERMISSIONS.STAFF.viewShift,
    },
    {
      title: 'Attendance',
      description: 'Review staff clock events and hours from one place.',
      href: '/staff/timeclock',
      permission: PERMISSIONS.STAFF.viewAttendance,
    },
    {
      title: 'Purchase Orders',
      description: 'Track supplier orders, receiving, and follow-up tasks.',
      href: '/suppliers/purchase-orders',
      permission: PERMISSIONS.SUPPLIER.viewSupplier,
    },
    {
      title: 'Low Stock Alerts',
      description: 'Jump straight to items that need reordering.',
      href: '/stock-control/low-stock',
      permission: PERMISSIONS.STOCK.viewStock,
    },
    {
      title: 'Stock Takes',
      description: 'Run cycle counts and reconcile physical inventory.',
      href: '/stock-control/stock-takes',
      permission: PERMISSIONS.STOCK.conductStockTake,
    },
    {
      title: 'Stock Valuation',
      description: 'See the current value tied up in inventory.',
      href: '/stock-control/valuation',
      permission: PERMISSIONS.STOCK.viewStockValuation,
    },
    {
      title: 'Customer Broadcast',
      description: 'Send campaigns and announcements to customer segments.',
      href: '/customers/broadcast',
      permission: PERMISSIONS.CUSTOMER.viewCustomer,
    },
    {
      title: 'Import Customers',
      description: 'Bulk load customers from CSV without leaving the owner workflow.',
      href: '/customers/import',
      permission: PERMISSIONS.CUSTOMER.createCustomer,
    },
    {
      title: 'Cash Flow',
      description: 'Monitor expense movements and operating cash trends.',
      href: '/expenses/cash-flow',
      permission: PERMISSIONS.REPORT.viewCashflowReport,
    },
    {
      title: 'Staff Commissions',
      description: 'Review earned commissions and payout history.',
      href: '/staff/commissions',
      permission: PERMISSIONS.STAFF.viewStaff,
    },
    {
      title: 'Returns Analytics',
      description: 'Track refund patterns and return-rate performance.',
      href: '/reports/return-rate',
      permission: PERMISSIONS.REPORT.viewSalesReport,
    },
  ].filter((link) => permissions.includes(link.permission));

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-espresso">
          Dashboard
        </h1>
        {tenant && <p className="mt-1 text-sm text-sand">{tenant.name}</p>}
      </div>

      {/* KPI Cards */}
      <Suspense fallback={<StatsSkeleton />}>
        <TodayStats tenantId={tenantId} />
      </Suspense>

      {permissions.includes(PERMISSIONS.STOCK.viewStock) && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-espresso">Inventory Snapshot</h2>
            <p className="mt-1 text-sm text-sand">
              Stock KPIs and the freshest movement trail, pulled into the owner dashboard.
            </p>
          </div>

          <StockSummaryWidgets permissions={permissions} />
        </div>
      )}

      {quickLinks.length > 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-espresso">Quick Access</h2>
            <p className="mt-1 text-sm text-sand">
              Jump into the owner pages that are now wired up for everyday operations.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {quickLinks.map((link) => (
              <QuickAccessCard
                key={link.href}
                title={link.title}
                description={link.description}
                href={link.href}
              />
            ))}
          </div>
        </div>
      )}

      {/* Bottom panels */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Sales */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold text-espresso">
              Recent Sales
            </CardTitle>
            <Link
              href="/sales"
              className="text-xs text-terracotta hover:underline"
            >
              View all →
            </Link>
          </CardHeader>
          <CardContent className="px-0">
            <Suspense fallback={<TableSkeleton />}>
              <RecentSales tenantId={tenantId} />
            </Suspense>
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold text-espresso">
              Low Stock Alerts
            </CardTitle>
            <Link
              href="/stock-control/low-stock"
              className="text-xs text-terracotta hover:underline"
            >
              View all →
            </Link>
          </CardHeader>
          <CardContent className="px-0">
            <Suspense fallback={<TableSkeleton />}>
              <LowStockItems tenantId={tenantId} />
            </Suspense>
          </CardContent>
        </Card>
      </div>

      {permissions.includes(PERMISSIONS.STOCK.viewStock) && <RecentStockMovementsCard />}
    </div>
  );
}
