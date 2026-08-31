import { MetricCard } from '@/components/superadmin/MetricCard';
import { formatLKR } from '@/lib/format';
import { Store, Users, Package, TrendingUp, ShoppingBag, AlertTriangle } from 'lucide-react';
import type { CombinedMetrics } from '@/lib/superadmin/business-stats';

export default function CombinedMetricsView({
  metrics,
  tenantCount,
}: {
  metrics: CombinedMetrics;
  tenantCount: number;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-espresso text-xl font-semibold">
            Combined Business Statistics
          </h2>
          <p className="text-mist mt-1 text-sm">
            Rolled up across all {tenantCount} live businesses.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="Total Revenue (All Time)"
          value={formatLKR(metrics.totalRevenue)}
          icon={<TrendingUp className="h-6 w-6" />}
        />
        <MetricCard
          label="Total Sales (All Time)"
          value={metrics.totalSales.toLocaleString()}
          icon={<ShoppingBag className="h-6 w-6" />}
        />
        <MetricCard
          label="Total Businesses"
          value={tenantCount}
          icon={<Store className="h-6 w-6" />}
        />
        <MetricCard
          label="Total Staff"
          value={metrics.totalStaff.toLocaleString()}
          icon={<Users className="h-6 w-6" />}
        />
        <MetricCard
          label="Total Products"
          value={metrics.totalProducts.toLocaleString()}
          icon={<Package className="h-6 w-6" />}
        />
        <MetricCard
          label="Total Customers"
          value={metrics.totalCustomers.toLocaleString()}
          icon={<Users className="h-6 w-6" />}
        />
        <MetricCard
          label="Low Stock Alerts"
          value={metrics.lowStockCount.toLocaleString()}
          icon={<AlertTriangle className="h-6 w-6" />}
        />
        <MetricCard
          label="Total Returns"
          value={metrics.totalReturns.toLocaleString()}
          icon={<ShoppingBag className="h-6 w-6" />}
        />
        <MetricCard
          label="Total Expenses"
          value={formatLKR(metrics.totalExpenses)}
          icon={<TrendingUp className="h-6 w-6" />}
        />
      </div>
    </div>
  );
}
