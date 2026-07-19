import Link from 'next/link';
import {
  BarChart3,
  ClipboardList,
  Clock,
  DollarSign,
  Import,
  Mail,
  Megaphone,
  Package,
  RefreshCcw,
  ScrollText,
  ShoppingCart,
  Truck,
  Users,
} from 'lucide-react';
import { PERMISSIONS } from '@/lib/constants/permissions';

interface QuickNavProps {
  permissions: string[];
}

const NAV_ITEMS = [
  {
    label: 'Sales',
    href: '/sales',
    icon: ShoppingCart,
    permission: PERMISSIONS.SALE.viewSale,
  },
  {
    label: 'Returns',
    href: '/returns',
    icon: RefreshCcw,
    permission: PERMISSIONS.SALE.viewSale,
  },
  {
    label: 'Shifts',
    href: '/staff/shifts',
    icon: Clock,
    permission: PERMISSIONS.STAFF.viewShift,
  },
  {
    label: 'Attendance',
    href: '/staff/timeclock',
    icon: ClipboardList,
    permission: PERMISSIONS.STAFF.viewAttendance,
  },
  {
    label: 'Purchase Orders',
    href: '/suppliers/purchase-orders',
    icon: Truck,
    permission: PERMISSIONS.SUPPLIER.viewSupplier,
  },
  {
    label: 'Low Stock',
    href: '/stock-control/low-stock',
    icon: Package,
    permission: PERMISSIONS.STOCK.viewStock,
  },
  {
    label: 'Stock Takes',
    href: '/stock-control/stock-takes',
    icon: ScrollText,
    permission: PERMISSIONS.STOCK.conductStockTake,
  },
  {
    label: 'Valuation',
    href: '/stock-control/valuation',
    icon: DollarSign,
    permission: PERMISSIONS.STOCK.viewStockValuation,
  },
  {
    label: 'Broadcast',
    href: '/customers/broadcast',
    icon: Megaphone,
    permission: PERMISSIONS.CUSTOMER.viewCustomer,
  },
  {
    label: 'Import',
    href: '/customers/import',
    icon: Import,
    permission: PERMISSIONS.CUSTOMER.createCustomer,
  },
  {
    label: 'Cash Flow',
    href: '/expenses/cash-flow',
    icon: BarChart3,
    permission: PERMISSIONS.REPORT.viewCashflowReport,
  },
  {
    label: 'Commissions',
    href: '/staff/commissions',
    icon: Users,
    permission: PERMISSIONS.STAFF.viewStaff,
  },
  {
    label: 'Return Rate',
    href: '/reports/return-rate',
    icon: Mail,
    permission: PERMISSIONS.REPORT.viewSalesReport,
  },
] as const;

export function QuickNav({ permissions }: QuickNavProps) {
  const items = NAV_ITEMS.filter((item) =>
    permissions.includes(item.permission),
  );

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex items-center gap-2 rounded-lg border border-mist bg-pearl px-3 py-2 text-sm text-espresso transition-colors hover:border-terracotta/40 hover:bg-linen"
        >
          <item.icon className="h-4 w-4 text-terracotta" />
          <span>{item.label}</span>
        </Link>
      ))}
    </div>
  );
}
