import { RevenueTrendChart } from '@/components/dashboard/charts/RevenueTrendChart';
import { SalesByPaymentChart } from '@/components/dashboard/charts/SalesByPaymentChart';
import { TopProductsChart } from '@/components/dashboard/charts/TopProductsChart';
import type { BusinessChartData } from '@/lib/superadmin/business-stats';

export default function BusinessCharts({ charts }: { charts: BusinessChartData }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <RevenueTrendChart data={charts.dailyRevenue} />
      </div>
      <SalesByPaymentChart data={charts.paymentBreakdown} />
      <TopProductsChart data={charts.topProducts} />
    </div>
  );
}
