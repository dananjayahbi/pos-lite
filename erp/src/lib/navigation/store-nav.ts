import type { UserRole } from '@/generated/prisma/client';
import {
  ArrowLeftRight,
  BadgePercent,
  Banknote,
  Barcode,
  Bell,
  Bookmark,
  Box,
  Boxes,
  Building2,
  ChartColumn,
  ChartSpline,
  ClipboardCheck,
  ClipboardList,
  Clock4,
  Factory,
  FileSpreadsheet,
  FolderTree,
  Globe,
  HandCoins,
  IdCard,
  Landmark,
  LayoutDashboard,
  ListTree,
  Megaphone,
  Package,
  PackageX,
  Percent,
  PiggyBank,
  Printer,
  QrCode,
  Receipt,
  ReceiptText,
  Ruler,
  Scale,
  ScanLine,
  ScrollText,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sprout,
  Stethoscope,
  Sticker,
  Store,
  Table,
  Tag,
  Target,
  Ticket,
  Timer,
  TrendingUp,
  TriangleAlert,
  Truck,
  Undo2,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { PERMISSIONS, type PermissionKey } from '@/lib/constants/permissions';

export interface NavItem {
  name: string;
  href: string;
  /** Sidebar glyph; every item needs its own so the rail stays scannable. */
  icon: LucideIcon;
  roles?: UserRole[];
  permission?: PermissionKey;
  match?: 'exact' | 'prefix';
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * True when `pathname` is the item's own route or a descendant of it.
 *
 * `exact` items only match their route, which keeps section entries such as
 * `/settings/store` from lighting up on unrelated child pages.
 */
export function isNavItemActive(
  pathname: string,
  item: Pick<NavItem, 'href' | 'match'>,
): boolean {
  if (item.match === 'exact') return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/**
 * Resolves the single nav item that should be highlighted for `pathname`.
 *
 * Prefix matching on its own highlights every ancestor: on
 * `/inventory/barcode-printing` both `/inventory` and the barcode page match.
 * The most specific (longest) href wins, so exactly one item is ever active.
 */
export function resolveActiveNavHref(pathname: string, items: NavItem[]): string | null {
  let best: NavItem | null = null;
  for (const item of items) {
    if (!isNavItemActive(pathname, item)) continue;
    if (!best || item.href.length > best.href.length) best = item;
  }
  return best?.href ?? null;
}

/**
 * Store sidebar information architecture.
 *
 * Ordered by the operator's workflow (retail → stock → purchasing/factory →
 * delivery → CRM → HR → finance → reports → settings). Every routable store page
 * that existed before is retained; only grouping and labels changed.
 */
export const storeNavGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        name: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        roles: ['OWNER', 'MANAGER', 'STOCK_CLERK'],
        match: 'exact',
      },
      {
        name: 'Notifications',
        href: '/notifications',
        icon: Bell,
      },
    ],
  },
  {
    label: 'Retail & Clinic',
    items: [
      {
        name: 'POS Terminal',
        href: '/pos',
        icon: ScanLine,
        permission: PERMISSIONS.SALE.createSale,
        match: 'exact',
      },
      {
        name: 'Sales',
        href: '/sales',
        icon: ReceiptText,
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.SALE.viewSale,
      },
      {
        name: 'Returns & Refunds',
        href: '/returns',
        icon: Undo2,
        roles: ['OWNER', 'MANAGER', 'CASHIER'],
        permission: PERMISSIONS.SALE.viewSale,
      },
      {
        name: 'Cashier Shifts',
        href: '/staff/shifts',
        icon: Timer,
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.STAFF.viewShift,
      },
      {
        name: 'Doctor Appointments',
        href: '/appointments',
        icon: Stethoscope,
        roles: ['OWNER', 'MANAGER', 'CASHIER'],
        permission: PERMISSIONS.APPOINTMENT.viewAppointment,
        match: 'exact',
      },
    ],
  },
  {
    label: 'Inventory',
    items: [
      {
        name: 'Products & Stock',
        href: '/inventory',
        icon: Package,
        roles: ['OWNER', 'MANAGER', 'STOCK_CLERK'],
        permission: PERMISSIONS.PRODUCT.viewProduct,
      },
      {
        name: 'Barcode Printing',
        href: '/inventory/barcode-printing',
        icon: Barcode,
        roles: ['OWNER', 'MANAGER', 'STOCK_CLERK'],
        permission: PERMISSIONS.PRODUCT.viewProduct,
      },
      {
        name: 'Categories',
        href: '/categories',
        icon: FolderTree,
        roles: ['OWNER', 'MANAGER', 'STOCK_CLERK'],
        permission: PERMISSIONS.PRODUCT.viewProduct,
        match: 'exact',
      },
      {
        name: 'Brands',
        href: '/brands',
        icon: Tag,
        roles: ['OWNER', 'MANAGER', 'STOCK_CLERK'],
        permission: PERMISSIONS.PRODUCT.viewProduct,
        match: 'exact',
      },
      {
        name: 'Stock Control',
        href: '/stock-control',
        icon: Boxes,
        roles: ['OWNER', 'MANAGER', 'STOCK_CLERK'],
        permission: PERMISSIONS.STOCK.viewStock,
        match: 'exact',
      },
      {
        name: 'Stock Adjustments',
        href: '/stock-control/adjust',
        icon: SlidersHorizontal,
        roles: ['OWNER', 'MANAGER', 'STOCK_CLERK'],
        permission: PERMISSIONS.STOCK.adjustStock,
      },
      {
        name: 'Stock Movements',
        href: '/stock-control/movements',
        icon: ArrowLeftRight,
        roles: ['OWNER', 'MANAGER', 'STOCK_CLERK'],
        permission: PERMISSIONS.STOCK.viewStock,
      },
      {
        name: 'Stock Takes (Cycle Counts)',
        href: '/stock-control/stock-takes',
        icon: ClipboardCheck,
        roles: ['OWNER', 'MANAGER', 'STOCK_CLERK'],
        permission: PERMISSIONS.STOCK.conductStockTake,
      },
      {
        name: 'Low Stock Alerts',
        href: '/stock-control/low-stock',
        icon: TriangleAlert,
        roles: ['OWNER', 'MANAGER', 'STOCK_CLERK'],
        permission: PERMISSIONS.STOCK.viewStock,
      },
      {
        name: 'Stock Valuation',
        href: '/stock-control/valuation',
        icon: ChartColumn,
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.STOCK.viewStockValuation,
      },
    ],
  },
  {
    label: 'Purchases & Factory',
    items: [
      {
        name: 'Purchase Orders (PO)',
        href: '/suppliers/purchase-orders',
        icon: ClipboardList,
        roles: ['OWNER', 'MANAGER', 'STOCK_CLERK'],
        permission: PERMISSIONS.SUPPLIER.viewSupplier,
      },
      {
        name: 'Suppliers',
        href: '/suppliers',
        icon: Building2,
        roles: ['OWNER', 'MANAGER', 'STOCK_CLERK'],
        permission: PERMISSIONS.SUPPLIER.viewSupplier,
        match: 'exact',
      },
      {
        name: 'Raw Materials',
        href: '/factory/raw-materials',
        icon: Sprout,
        roles: ['OWNER', 'MANAGER', 'FACTORY_MANAGER'],
        permission: PERMISSIONS.RAW_MATERIAL.viewRawMaterial,
        match: 'exact',
      },
      {
        name: 'Bill of Materials (BOM)',
        href: '/factory/bom',
        icon: ListTree,
        roles: ['OWNER', 'MANAGER', 'FACTORY_MANAGER'],
        permission: PERMISSIONS.BOM.viewBom,
        match: 'exact',
      },
      {
        name: 'Factory Dashboard',
        href: '/factory',
        icon: Factory,
        roles: ['OWNER', 'MANAGER', 'FACTORY_MANAGER'],
        permission: PERMISSIONS.FACTORY.viewFactoryDashboard,
        match: 'exact',
      },
    ],
  },
  {
    label: 'Delivery & Courier',
    items: [
      {
        name: 'Dispatch Orders',
        href: '/orders',
        icon: Ticket,
        roles: ['OWNER', 'MANAGER', 'CASHIER', 'DISPATCH_STAFF'],
        permission: PERMISSIONS.DELIVERY.viewDelivery,
        match: 'exact',
      },
      {
        name: 'Deliveries & Tracking',
        href: '/delivery',
        icon: Truck,
        roles: ['OWNER', 'MANAGER', 'CASHIER', 'DISPATCH_STAFF'],
        permission: PERMISSIONS.DELIVERY.viewDelivery,
        match: 'exact',
      },
      {
        name: 'Packaging Stock',
        href: '/delivery/packaging',
        icon: Box,
        roles: ['OWNER', 'MANAGER', 'DISPATCH_STAFF'],
        permission: PERMISSIONS.DELIVERY.managePackaging,
        match: 'exact',
      },
      {
        name: 'Courier Settings & Rates',
        href: '/delivery/settings',
        icon: Settings2,
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.DELIVERY.manageCourierSettings,
        match: 'exact',
      },
      {
        name: 'Rate Card',
        href: '/delivery/rate-card',
        icon: Table,
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.DELIVERY.manageRateCard,
        match: 'exact',
      },
      {
        name: 'Waybill Design',
        href: '/delivery/label',
        icon: Sticker,
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.DELIVERY.manageLabelTemplate,
        match: 'exact',
      },
      {
        name: 'Failed Deliveries & Recovery',
        href: '/delivery/failed',
        icon: PackageX,
        roles: ['OWNER', 'MANAGER', 'DISPATCH_STAFF'],
        permission: PERMISSIONS.REPORT.viewRecoveryReport,
        match: 'exact',
      },
    ],
  },
  {
    label: 'CRM & Marketing',
    items: [
      {
        name: 'Customers',
        href: '/customers',
        icon: Users,
        roles: ['OWNER', 'MANAGER', 'CASHIER'],
        permission: PERMISSIONS.CUSTOMER.viewCustomer,
        match: 'exact',
      },
      {
        name: 'Customer Broadcast',
        href: '/customers/broadcast',
        icon: Megaphone,
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.CUSTOMER.viewCustomer,
        match: 'exact',
      },
      {
        name: 'Promotions & Discounts',
        href: '/promotions',
        icon: BadgePercent,
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.PROMOTION.createPromotion,
      },
    ],
  },
  {
    label: 'HR & Payroll',
    items: [
      {
        name: 'Staff Directory',
        href: '/staff',
        icon: IdCard,
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.STAFF.viewStaff,
        match: 'exact',
      },
      {
        name: 'Attendance & Timeclock',
        href: '/staff/timeclock',
        icon: Clock4,
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.STAFF.viewAttendance,
      },
      {
        name: 'Staff Commissions',
        href: '/staff/commissions',
        icon: HandCoins,
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.PAYROLL.viewPayroll,
      },
      {
        name: 'Run Payroll',
        href: '/payroll',
        icon: Banknote,
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.PAYROLL.viewPayroll,
        match: 'exact',
      },
      {
        name: 'Payroll Reports & Bank Sheets',
        href: '/payroll/reports',
        icon: FileSpreadsheet,
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.PAYROLL.viewPayroll,
      },
    ],
  },
  {
    label: 'Finance & Cash',
    items: [
      {
        name: 'Expenses',
        href: '/expenses',
        icon: Receipt,
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.EXPENSE.viewExpense,
        match: 'exact',
      },
      {
        name: 'Petty Cash',
        href: '/petty-cash',
        icon: PiggyBank,
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.PETTY_CASH.viewPettyCash,
        match: 'exact',
      },
      {
        name: 'Cash Flow',
        href: '/expenses/cash-flow',
        icon: ChartSpline,
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.REPORT.viewCashflowReport,
      },
      {
        name: 'Payment Accounts',
        href: '/payment-accounts',
        icon: Landmark,
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.PAYMENT_ACCOUNT.managePaymentAccount,
      },
      {
        name: 'Courier Reconciliation',
        href: '/delivery/reconciliation',
        icon: Scale,
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.DELIVERY.viewReconciliation,
        match: 'exact',
      },
    ],
  },
  {
    label: 'Reports & Audit',
    items: [
      {
        name: 'Profit & Loss',
        href: '/reports/profit-loss',
        icon: TrendingUp,
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.REPORT.viewProfitReport,
      },
      {
        name: 'Recovery Performance',
        href: '/reports/recovery-staff-performance',
        icon: Target,
        roles: ['OWNER', 'MANAGER', 'DISPATCH_STAFF'],
        permission: PERMISSIONS.REPORT.viewRecoveryReport,
      },
      {
        name: 'Saved Reports',
        href: '/reports/saved',
        icon: Bookmark,
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.REPORT.viewSalesReport,
      },
      {
        name: 'Audit Log',
        href: '/settings/audit-log',
        icon: ScrollText,
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.SETTINGS.viewSettings,
      },
    ],
  },
  {
    label: 'Settings',
    items: [
      {
        name: 'Team & Permissions',
        href: '/settings/users',
        icon: ShieldCheck,
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.SETTINGS.manageUsers,
      },
      {
        name: 'Hardware & POS Printers',
        href: '/settings/hardware',
        icon: Printer,
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.SETTINGS.manageHardware,
      },
      {
        // ARGUS #477: the label used to promise "Taxes & Store Settings" while
        // linking only to /settings/taxes. The store profile has its own entry,
        // so the label now matches the page; both pages cross-link.
        name: 'Taxes',
        href: '/settings/taxes',
        icon: Percent,
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.SETTINGS.manageTax,
      },
      {
        name: 'Units',
        href: '/settings/units',
        icon: Ruler,
        roles: ['OWNER', 'MANAGER', 'FACTORY_MANAGER'],
        permission: PERMISSIONS.RAW_MATERIAL.viewRawMaterial,
      },
      {
        name: 'Payments & LankaQR',
        href: '/settings/payments',
        icon: QrCode,
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.SETTINGS.managePayments,
      },
      {
        name: 'Store Profile',
        href: '/settings/store',
        icon: Store,
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.SETTINGS.manageStoreProfile,
      },
      {
        name: 'Website CMS',
        href: '/settings/website',
        icon: Globe,
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.SETTINGS.manageWebsite,
      },
      {
        name: 'My Account',
        href: '/settings/account',
        icon: UserRound,
        roles: ['OWNER', 'MANAGER', 'CASHIER', 'STOCK_CLERK'],
      },
    ],
  },
];
