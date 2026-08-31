import { MetricCard } from '@/components/superadmin/MetricCard';
import { formatLKR } from '@/lib/format';
import {
  TrendingUp,
  ShoppingBag,
  Users,
  Package,
  AlertTriangle,
  Wallet,
  Boxes,
  BadgePercent,
  Repeat,
} from 'lucide-react';
import type { BusinessMetrics } from '@/lib/superadmin/business-stats';

export default function BusinessMetricCards({ metrics }: { metrics: BusinessMetrics }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      <MetricCard
        label="Revenue (All Time)"
        value={formatLKR(metrics.totalRevenue)}
        icon={<TrendingUp className="h-6 w-6" />}
      />
      <MetricCard
        label="Sales (All Time)"
        value={metrics.totalSales.toLocaleString()}
        icon={<ShoppingBag className="h-6 w-6" />}
      />
      <MetricCard
        label="Revenue (This Month)"
        value={formatLKR(metrics.monthRevenue)}
        icon={<TrendingUp className="h-6 w-6" />}
      />
      <MetricCard
        label="Sales (This Month)"
        value={metrics.monthSales.toLocaleString()}
        icon={<ShoppingBag className="h-6 w-6" />}
      />
      <MetricCard
        label="Total Customers"
        value={metrics.totalCustomers.toLocaleString()}
        icon={<Users className="h-6 w-6" />}
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
        label="Active Variants"
        value={metrics.totalVariants.toLocaleString()}
        icon={<Boxes className="h-6 w-6" />}
      />
      <MetricCard
        label="Low Stock Alerts"
        value={metrics.lowStockCount.toLocaleString()}
        icon={<AlertTriangle className="h-6 w-6" />}
      />
      <MetricCard
        label="Total Returns"
        value={metrics.totalReturns.toLocaleString()}
        icon={<Repeat className="h-6 w-6" />}
      />
      <MetricCard
        label="Total Expenses"
        value={formatLKR(metrics.totalExpenses)}
        icon={<Wallet className="h-6 w-6" />}
      />
      <MetricCard
        label="Open Shifts"
        value={metrics.openShifts.toLocaleString()}
        icon={<BadgePercent className="h-6 w-6" />}
      />
    </div>
  );
}
