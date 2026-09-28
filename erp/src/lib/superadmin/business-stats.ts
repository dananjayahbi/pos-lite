import { prisma } from '@/lib/prisma';
import type { TenantStatus, SubscriptionStatus } from '@/generated/prisma/client';
import type { DailyRevenue, PaymentBreakdown, TopProduct } from '@/components/dashboard/charts/types';

// ---------------------------------------------------------------------------
// Server-side aggregation helpers for the superadmin "Businesses" section.
// These consolidate real per-tenant operational data so the superadmin can view
// each business's statistics without dipping into the tenant dashboard.
// ---------------------------------------------------------------------------

export interface BusinessBasic {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  status: TenantStatus;
  subscriptionStatus: SubscriptionStatus;
  createdAt: Date;
}

export interface BusinessMetrics {
  totalRevenue: number;
  totalSales: number;
  monthRevenue: number;
  monthSales: number;
  totalCustomers: number;
  totalProducts: number;
  totalVariants: number;
  totalStaff: number;
  lowStockCount: number;
  totalReturns: number;
  totalExpenses: number;
  openShifts: number;
  todayRevenue: number;
  todaySales: number;
  todayCustomers: number;
}

export interface BusinessChartData {
  dailyRevenue: DailyRevenue[];
  paymentBreakdown: PaymentBreakdown[];
  topProducts: TopProduct[];
}

export interface BusinessStats {
  tenant: BusinessBasic;
  settings: {
    currency: string;
    timezone: string;
    vatRate: number;
    ssclRate: number;
    receiptFooter: string;
  };
  metrics: BusinessMetrics;
  charts: BusinessChartData;
}

export interface CombinedMetrics {
  totalRevenue: number;
  totalSales: number;
  totalCustomers: number;
  totalProducts: number;
  totalVariants: number;
  totalStaff: number;
  lowStockCount: number;
  totalReturns: number;
  totalExpenses: number;
}

export interface PerTenantMetric {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  logoUrl: string | null;
  revenue: number;
  sales: number;
  customers: number;
  products: number;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

function toNumber(value: number | { toNumber(): number } | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : value.toNumber();
}

/** Fetch operational statistics for a single business (tenant). */
export async function getBusinessStats(tenantId: string): Promise<BusinessStats | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      _count: {
        select: {
          users: { where: { deletedAt: null } },
          products: { where: { deletedAt: null } },
        },
      },
    },
  });

  if (!tenant) return null;

  const since7 = daysAgo(7);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

  const settings = (tenant.settings ?? {}) as Record<string, unknown>;

  const [
    completedSales,
    lowStockResult,
    openShifts,
    returned,
    expenses,
    todaySales,
    monthSales,
    allTimeSales,
  ] = await Promise.all([
    prisma.sale.findMany({
      where: {
        tenantId,
        status: 'COMPLETED',
        completedAt: { gte: since7 },
      },
      include: {
        lines: {
          select: {
            quantity: true,
            unitPrice: true,
            productNameSnapshot: true,
          },
        },
      },
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
    prisma.shift.count({ where: { tenantId, status: 'OPEN' } }),
    prisma.return.count({ where: { tenantId } }),
    prisma.expense.aggregate({
      where: { tenantId },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.sale.findMany({
      where: { tenantId, status: 'COMPLETED', completedAt: { gte: todayStart } },
      select: { totalAmount: true },
    }),
    prisma.sale.findMany({
      where: { tenantId, status: 'COMPLETED', completedAt: { gte: monthStart } },
      select: { totalAmount: true },
    }),
    prisma.sale.aggregate({
      where: { tenantId, status: 'COMPLETED' },
      _sum: { totalAmount: true },
      _count: true,
    }),
  ]);

  const [totalCustomers, totalVariants, totalStaff] = await Promise.all([
    prisma.customer.count({ where: { tenantId, deletedAt: null } }),
    prisma.productVariant.count({ where: { tenantId, deletedAt: null } }),
    prisma.user.count({ where: { tenantId, deletedAt: null, role: { not: 'SUPER_ADMIN' } } }),
  ]);

  // ---- Chart folds (mirrors the store dashboard) ----
  const dayMap = new Map<string, { revenue: number; salesCount: number }>();
  for (let i = 6; i >= 0; i--) {
    const d = daysAgo(i);
    dayMap.set(d.toISOString().slice(0, 10), { revenue: 0, salesCount: 0 });
  }
  for (const sale of completedSales) {
    const key = new Date(sale.completedAt!).toISOString().slice(0, 10);
    const bucket = dayMap.get(key);
    if (bucket) {
      bucket.revenue += toNumber(sale.totalAmount);
      bucket.salesCount += 1;
    }
  }
  const dailyRevenue: DailyRevenue[] = Array.from(dayMap.entries()).map(([date, v]) => ({
    date,
    ...v,
  }));

  const payMap = new Map<string, { count: number; total: number }>();
  for (const sale of completedSales) {
    const method = sale.paymentMethod ?? 'OTHER';
    const bucket = payMap.get(method) ?? { count: 0, total: 0 };
    bucket.count += 1;
    bucket.total += toNumber(sale.totalAmount);
    payMap.set(method, bucket);
  }
  const paymentBreakdown: PaymentBreakdown[] = Array.from(payMap.entries()).map(([method, v]) => ({
    method,
    ...v,
  }));

  const productMap = new Map<string, { quantity: number; revenue: number }>();
  for (const sale of completedSales) {
    for (const line of sale.lines) {
      const existing = productMap.get(line.productNameSnapshot) ?? { quantity: 0, revenue: 0 };
      existing.quantity += line.quantity;
      existing.revenue += toNumber(line.unitPrice) * line.quantity;
      productMap.set(line.productNameSnapshot, existing);
    }
  }
  const topProducts: TopProduct[] = Array.from(productMap.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 7);

  const todayRevenue = todaySales.reduce((sum, s) => sum + toNumber(s.totalAmount), 0);
  const monthRevenue = monthSales.reduce((sum, s) => sum + toNumber(s.totalAmount), 0);

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      logoUrl: tenant.logoUrl,
      status: tenant.status,
      subscriptionStatus: tenant.subscriptionStatus,
      createdAt: tenant.createdAt,
    },
    settings: {
      currency: typeof settings.currency === 'string' ? settings.currency : 'LKR',
      timezone: typeof settings.timezone === 'string' ? settings.timezone : 'Asia/Colombo',
      vatRate: typeof settings.vatRate === 'number' ? settings.vatRate : 0,
      ssclRate: typeof settings.ssclRate === 'number' ? settings.ssclRate : 0,
      receiptFooter: typeof settings.receiptFooter === 'string' ? settings.receiptFooter : '',
    },
    metrics: {
      totalRevenue: toNumber(allTimeSales._sum.totalAmount),
      totalSales: allTimeSales._count,
      monthRevenue,
      monthSales: monthSales.length,
      totalCustomers,
      totalProducts: tenant._count.products,
      totalVariants,
      totalStaff,
      lowStockCount: Number(lowStockResult[0]?.count ?? 0),
      totalReturns: returned,
      totalExpenses: toNumber(expenses._sum.amount),
      openShifts,
      todayRevenue,
      todaySales: todaySales.length,
      todayCustomers: totalCustomers,
    },
    charts: { dailyRevenue, paymentBreakdown, topProducts },
  };
}

/**
 * Fetch all-time metrics for every live business, plus a combined rollup across
 * all of them. Uses all-time values so the superadmin dashboard shows the full
 * picture of both businesses regardless of the current calendar month.
 */
export async function getCombinedBusinessStats(): Promise<{
  combined: CombinedMetrics;
  perTenant: PerTenantMetric[];
}> {
  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });

  const perTenant: PerTenantMetric[] = [];
  const combined: CombinedMetrics = {
    totalRevenue: 0,
    totalSales: 0,
    totalCustomers: 0,
    totalProducts: 0,
    totalVariants: 0,
    totalStaff: 0,
    lowStockCount: 0,
    totalReturns: 0,
    totalExpenses: 0,
  };

  for (const tenant of tenants) {
    const [
      revenueAgg,
      customerCount,
      variantCount,
      staffCount,
      lowStockResult,
      returnCount,
      expenseAgg,
      productCount,
    ] = await Promise.all([
      prisma.sale.aggregate({
        where: { tenantId: tenant.id, status: 'COMPLETED' },
        _sum: { totalAmount: true },
        _count: true,
      }),
      prisma.customer.count({ where: { tenantId: tenant.id, deletedAt: null } }),
      prisma.productVariant.count({ where: { tenantId: tenant.id, deletedAt: null } }),
      prisma.user.count({ where: { tenantId: tenant.id, deletedAt: null, role: { not: 'SUPER_ADMIN' } } }),
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count
        FROM "product_variants" pv
        JOIN "products" p ON pv."productId" = p."id"
        WHERE pv."tenantId" = ${tenant.id}
          AND pv."deletedAt" IS NULL
          AND p."isArchived" = false
          AND p."deletedAt" IS NULL
          AND pv."stockQuantity" <= pv."lowStockThreshold"
      `,
      prisma.return.count({ where: { tenantId: tenant.id } }),
      prisma.expense.aggregate({
        where: { tenantId: tenant.id },
        _sum: { amount: true },
      }),
      prisma.product.count({ where: { tenantId: tenant.id, deletedAt: null } }),
    ]);

    combined.totalRevenue += toNumber(revenueAgg._sum.totalAmount);
    combined.totalSales += revenueAgg._count;
    combined.totalCustomers += customerCount;
    combined.totalProducts += productCount;
    combined.totalVariants += variantCount;
    combined.totalStaff += staffCount;
    combined.lowStockCount += Number(lowStockResult[0]?.count ?? 0);
    combined.totalReturns += returnCount;
    combined.totalExpenses += toNumber(expenseAgg._sum.amount);

    perTenant.push({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      logoUrl: tenant.logoUrl,
      revenue: toNumber(revenueAgg._sum.totalAmount),
      sales: revenueAgg._count,
      customers: customerCount,
      products: productCount,
    });
  }

  return { combined, perTenant };
}
