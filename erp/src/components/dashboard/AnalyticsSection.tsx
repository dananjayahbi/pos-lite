import { prisma } from '@/lib/prisma';
import { RevenueTrendChart } from './charts/RevenueTrendChart';
import { SalesByPaymentChart } from './charts/SalesByPaymentChart';
import { TopProductsChart } from './charts/TopProductsChart';
import {
  buildDailyRevenue,
  buildPaymentBreakdown,
  buildTopProducts,
  startOfLocalDay,
} from './charts/analytics';
import type { ChartAnalytics } from './charts/types';

function daysAgo(n: number): Date {
  const d = startOfLocalDay(new Date());
  d.setDate(d.getDate() - n);
  return d;
}

async function fetchChartAnalytics(tenantId: string): Promise<ChartAnalytics> {
  // Six days back + today = the 7 local calendar days shown in the charts.
  const since = daysAgo(6);

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
          lineTotalAfterDiscount: true,
          productNameSnapshot: true,
        },
      },
    },
  });

  return {
    dailyRevenue: buildDailyRevenue(sales),
    paymentBreakdown: buildPaymentBreakdown(sales),
    topProducts: buildTopProducts(sales),
  };
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
