import type { UserRole } from '@/generated/prisma/client';
import { PERMISSIONS, type PermissionKey } from '@/lib/constants/permissions';

export interface NavItem {
  name: string;
  href: string;
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
        roles: ['OWNER', 'MANAGER', 'STOCK_CLERK'],
        match: 'exact',
      },
      {
        name: 'Notifications',
        href: '/notifications',
      },
    ],
  },
  {
    label: 'Retail & Clinic',
    items: [
      {
        name: 'POS Terminal',
        href: '/pos',
        permission: PERMISSIONS.SALE.createSale,
        match: 'exact',
      },
      {
        name: 'Sales',
        href: '/sales',
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.SALE.viewSale,
      },
      {
        name: 'Returns & Refunds',
        href: '/returns',
        roles: ['OWNER', 'MANAGER', 'CASHIER'],
        permission: PERMISSIONS.SALE.viewSale,
      },
      {
        name: 'Cashier Shifts',
        href: '/staff/shifts',
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.STAFF.viewShift,
      },
      {
        name: 'Doctor Appointments',
        href: '/appointments',
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
        roles: ['OWNER', 'MANAGER', 'STOCK_CLERK'],
        permission: PERMISSIONS.PRODUCT.viewProduct,
      },
      {
        name: 'Barcode Printing',
        href: '/inventory/barcode-printing',
        roles: ['OWNER', 'MANAGER', 'STOCK_CLERK'],
        permission: PERMISSIONS.PRODUCT.viewProduct,
      },
      {
        name: 'Categories',
        href: '/categories',
        roles: ['OWNER', 'MANAGER', 'STOCK_CLERK'],
        permission: PERMISSIONS.PRODUCT.viewProduct,
        match: 'exact',
      },
      {
        name: 'Brands',
        href: '/brands',
        roles: ['OWNER', 'MANAGER', 'STOCK_CLERK'],
        permission: PERMISSIONS.PRODUCT.viewProduct,
        match: 'exact',
      },
      {
        name: 'Stock Control',
        href: '/stock-control',
        roles: ['OWNER', 'MANAGER', 'STOCK_CLERK'],
        permission: PERMISSIONS.STOCK.viewStock,
        match: 'exact',
      },
      {
        name: 'Stock Adjustments',
        href: '/stock-control/adjust',
        roles: ['OWNER', 'MANAGER', 'STOCK_CLERK'],
        permission: PERMISSIONS.STOCK.adjustStock,
      },
      {
        name: 'Stock Movements',
        href: '/stock-control/movements',
        roles: ['OWNER', 'MANAGER', 'STOCK_CLERK'],
        permission: PERMISSIONS.STOCK.viewStock,
      },
      {
        name: 'Stock Takes (Cycle Counts)',
        href: '/stock-control/stock-takes',
        roles: ['OWNER', 'MANAGER', 'STOCK_CLERK'],
        permission: PERMISSIONS.STOCK.conductStockTake,
      },
      {
        name: 'Low Stock Alerts',
        href: '/stock-control/low-stock',
        roles: ['OWNER', 'MANAGER', 'STOCK_CLERK'],
        permission: PERMISSIONS.STOCK.viewStock,
      },
      {
        name: 'Stock Valuation',
        href: '/stock-control/valuation',
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
        roles: ['OWNER', 'MANAGER', 'STOCK_CLERK'],
        permission: PERMISSIONS.SUPPLIER.viewSupplier,
      },
      {
        name: 'Suppliers',
        href: '/suppliers',
        roles: ['OWNER', 'MANAGER', 'STOCK_CLERK'],
        permission: PERMISSIONS.SUPPLIER.viewSupplier,
        match: 'exact',
      },
      {
        name: 'Raw Materials',
        href: '/factory/raw-materials',
        roles: ['OWNER', 'MANAGER', 'FACTORY_MANAGER'],
        permission: PERMISSIONS.RAW_MATERIAL.viewRawMaterial,
        match: 'exact',
      },
      {
        name: 'Bill of Materials (BOM)',
        href: '/factory/bom',
        roles: ['OWNER', 'MANAGER', 'FACTORY_MANAGER'],
        permission: PERMISSIONS.BOM.viewBom,
        match: 'exact',
      },
      {
        name: 'Factory Dashboard',
        href: '/factory',
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
        roles: ['OWNER', 'MANAGER', 'CASHIER', 'DISPATCH_STAFF'],
        permission: PERMISSIONS.DELIVERY.viewDelivery,
        match: 'exact',
      },
      {
        name: 'Deliveries & Tracking',
        href: '/delivery',
        roles: ['OWNER', 'MANAGER', 'CASHIER', 'DISPATCH_STAFF'],
        permission: PERMISSIONS.DELIVERY.viewDelivery,
        match: 'exact',
      },
      {
        name: 'Packaging Stock',
        href: '/delivery/packaging',
        roles: ['OWNER', 'MANAGER', 'DISPATCH_STAFF'],
        permission: PERMISSIONS.DELIVERY.managePackaging,
        match: 'exact',
      },
      {
        name: 'Courier Settings & Rates',
        href: '/delivery/settings',
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.DELIVERY.manageCourierSettings,
        match: 'exact',
      },
      {
        name: 'Rate Card',
        href: '/delivery/rate-card',
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.DELIVERY.manageRateCard,
        match: 'exact',
      },
      {
        name: 'Waybill Design',
        href: '/delivery/label',
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.DELIVERY.manageLabelTemplate,
        match: 'exact',
      },
      {
        name: 'Failed Deliveries & Recovery',
        href: '/reports/recovery-staff-performance',
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
        roles: ['OWNER', 'MANAGER', 'CASHIER'],
        permission: PERMISSIONS.CUSTOMER.viewCustomer,
        match: 'exact',
      },
      {
        name: 'Customer Broadcast',
        href: '/customers/broadcast',
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.CUSTOMER.viewCustomer,
        match: 'exact',
      },
      {
        name: 'Promotions & Discounts',
        href: '/promotions',
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
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.STAFF.viewStaff,
        match: 'exact',
      },
      {
        name: 'Attendance & Timeclock',
        href: '/staff/timeclock',
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.STAFF.viewAttendance,
      },
      {
        name: 'Staff Commissions',
        href: '/staff/commissions',
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.STAFF.viewStaff,
      },
      {
        name: 'Run Payroll',
        href: '/payroll',
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.PAYROLL.viewPayroll,
        match: 'exact',
      },
      {
        name: 'Payroll Reports & Bank Sheets',
        href: '/payroll/reports',
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
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.EXPENSE.viewExpense,
        match: 'exact',
      },
      {
        name: 'Petty Cash',
        href: '/petty-cash',
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.PETTY_CASH.viewPettyCash,
        match: 'exact',
      },
      {
        name: 'Cash Flow',
        href: '/expenses/cash-flow',
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.REPORT.viewCashflowReport,
      },
      {
        name: 'Payment Accounts',
        href: '/payment-accounts',
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.PAYMENT_ACCOUNT.managePaymentAccount,
      },
      {
        name: 'Courier Reconciliation',
        href: '/delivery/reconciliation',
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
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.REPORT.viewProfitReport,
      },
      {
        name: 'Saved Reports',
        href: '/reports/saved',
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.REPORT.viewSalesReport,
      },
      {
        name: 'Audit Log',
        href: '/settings/audit-log',
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
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.SETTINGS.manageUsers,
      },
      {
        name: 'Hardware & POS Printers',
        href: '/settings/hardware',
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.SETTINGS.manageHardware,
      },
      {
        name: 'Taxes & Store Settings',
        href: '/settings/taxes',
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.SETTINGS.manageTax,
      },
      {
        name: 'Units',
        href: '/settings/units',
        roles: ['OWNER', 'MANAGER', 'FACTORY_MANAGER'],
        permission: PERMISSIONS.RAW_MATERIAL.viewRawMaterial,
      },
      {
        name: 'Payments & LankaQR',
        href: '/settings/payments',
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.SETTINGS.managePayments,
      },
      {
        name: 'Store Profile',
        href: '/settings/store',
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.SETTINGS.manageStoreProfile,
      },
      {
        name: 'Website CMS',
        href: '/settings/website',
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.SETTINGS.manageWebsite,
      },
      {
        name: 'My Account',
        href: '/settings/account',
        roles: ['OWNER', 'MANAGER', 'CASHIER', 'STOCK_CLERK'],
      },
    ],
  },
];
