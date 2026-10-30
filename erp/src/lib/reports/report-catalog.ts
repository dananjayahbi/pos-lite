// ── Reports hub catalog (single source of truth) ────────────────────────────
// Backs the `/reports` landing page. Kept separate from
// `src/lib/reports/report-config.ts` because that registry is keyed by route
// pathname for export column/title resolution, whereas this one carries the
// navigation metadata (label, description, permission) the hub renders.
//
// Every `href` here must resolve to an existing `(store)/reports/*` page — the
// hub is a directory, so a stale link is a dead end for the user.

import { PERMISSIONS, type PermissionKey } from '@/lib/constants/permissions';

export interface ReportCatalogEntry {
  href: string;
  label: string;
  description: string;
  permission: PermissionKey;
}

export interface ReportCatalogGroup {
  label: string;
  description: string;
  entries: ReportCatalogEntry[];
}

export const REPORT_CATALOG: ReportCatalogGroup[] = [
  {
    label: 'Sales & Revenue',
    description: 'How the store is selling, and what it earns.',
    entries: [
      {
        href: '/reports/sales',
        label: 'Sales by Product',
        description: 'Units sold, gross and net revenue per product and variant.',
        permission: PERMISSIONS.REPORT.viewSalesReport,
      },
      {
        href: '/reports/revenue-trend',
        label: 'Revenue Trend',
        description: 'Revenue, returns and transaction counts over time.',
        permission: PERMISSIONS.REPORT.viewSalesReport,
      },
      {
        href: '/reports/profit-loss',
        label: 'Profit & Loss',
        description: 'Revenue less cost of goods, discounts and expenses.',
        permission: PERMISSIONS.REPORT.viewProfitReport,
      },
      {
        href: '/reports/return-rate',
        label: 'Return Rate',
        description: 'Return volume and rate against total sales.',
        permission: PERMISSIONS.REPORT.viewSalesReport,
      },
    ],
  },
  {
    label: 'Stock',
    description: 'Inventory value and movement history.',
    entries: [
      {
        href: '/reports/inventory-valuation',
        label: 'Inventory Valuation',
        description: 'Stock on hand valued at cost per variant.',
        permission: PERMISSIONS.REPORT.viewStockReport,
      },
      {
        href: '/reports/stock-movements',
        label: 'Stock Movements',
        description: 'Every adjustment, sale, return and transfer entry.',
        permission: PERMISSIONS.REPORT.viewStockReport,
      },
    ],
  },
  {
    label: 'People',
    description: 'Customer behaviour and staff performance.',
    entries: [
      {
        href: '/reports/customer-analytics',
        label: 'Customer Analytics',
        description: 'Purchase frequency, spend and top customers.',
        permission: PERMISSIONS.REPORT.viewCustomerReport,
      },
      {
        href: '/reports/staff-performance',
        label: 'Staff Performance',
        description: 'Sales, refunds and averages per staff member.',
        permission: PERMISSIONS.REPORT.viewSalesReport,
      },
      {
        href: '/reports/recovery-staff-performance',
        label: 'Recovery Performance',
        description: 'Cash-on-delivery recovery attempts and success rate.',
        permission: PERMISSIONS.REPORT.viewRecoveryReport,
      },
    ],
  },
  {
    label: 'Audit',
    description: 'Exception reporting for management review.',
    entries: [
      {
        href: '/reports/zero-value-sales',
        label: 'Zero-Value Audit',
        description: 'Sales recorded at zero value, with the stated reason.',
        permission: PERMISSIONS.REPORT.viewZeroValueReport,
      },
      {
        href: '/reports/saved',
        label: 'Saved Reports',
        description: 'Reopen report filters and generated files you saved earlier.',
        permission: PERMISSIONS.REPORT.viewSalesReport,
      },
    ],
  },
];

/** Reports the user is allowed to open, grouped by section (empty groups dropped). */
export function visibleReportCatalog(permissions: readonly string[]): ReportCatalogGroup[] {
  return REPORT_CATALOG.map((group) => ({
    ...group,
    entries: group.entries.filter((entry) => permissions.includes(entry.permission)),
  })).filter((group) => group.entries.length > 0);
}
