import { prisma } from '@/lib/prisma';
import { RevenueTrendChart } from './charts/RevenueTrendChart';
import { SalesByPaymentChart } from './charts/SalesByPaymentChart';
import { TopProductsChart } from './charts/TopProductsChart';
import type { ChartAnalytics } from './charts/types';

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

async function fetchChartAnalytics(tenantId: string): Promise<ChartAnalytics> {
  const since = daysAgo(7);

  const sales = await prisma.sale.findMany({
    where: {
      tenantId,
      status: 'COMPLETED',
      completedAt: { gte: since },
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
  });

  // --- Daily revenue ---
  const dayMap = new Map<string, { revenue: number; salesCount: number }>();
  for (let i = 6; i >= 0; i--) {
    const d = daysAgo(i);
    dayMap.set(d.toISOString().slice(0, 10), { revenue: 0, salesCount: 0 });
  }
  for (const sale of sales) {
    const key = new Date(sale.completedAt!).toISOString().slice(0, 10);
    const bucket = dayMap.get(key);
    if (bucket) {
      bucket.revenue += Number(sale.totalAmount);
      bucket.salesCount += 1;
    }
  }
  const dailyRevenue = Array.from(dayMap.entries()).map(([date, v]) => ({
    date,
    ...v,
  }));

  // --- Payment breakdown ---
  const payMap = new Map<string, { count: number; total: number }>();
  for (const sale of sales) {
    const method = sale.paymentMethod ?? 'OTHER';
    const bucket = payMap.get(method) ?? { count: 0, total: 0 };
    bucket.count += 1;
    bucket.total += Number(sale.totalAmount);
    payMap.set(method, bucket);
  }
  const paymentBreakdown = Array.from(payMap.entries()).map(([method, v]) => ({
    method,
    ...v,
  }));

  // --- Top products ---
  const productMap = new Map<string, { quantity: number; revenue: number }>();
  for (const sale of sales) {
    for (const line of sale.lines) {
      const existing = productMap.get(line.productNameSnapshot) ?? {
        quantity: 0,
        revenue: 0,
      };
      existing.quantity += line.quantity;
      existing.revenue += Number(line.unitPrice) * line.quantity;
      productMap.set(line.productNameSnapshot, existing);
    }
  }
  const topProducts = Array.from(productMap.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 7);

  return { dailyRevenue, paymentBreakdown, topProducts };
}

export async function AnalyticsSection({
  tenantId,
}: {
  tenantId: string;
}) {
  const analytics = await fetchChartAnalytics(tenantId);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <RevenueTrendChart data={analytics.dailyRevenue} />
      </div>
      <SalesByPaymentChart data={analytics.paymentBreakdown} />
      <TopProductsChart data={analytics.topProducts} />
    </div>
  );
}
