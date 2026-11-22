import { describe, it, expect } from 'vitest';

import {
  storeNavGroups,
  resolveActiveNavHref,
  type NavItem,
} from '@/lib/navigation/store-nav';

const EXPECTED_GROUPS = [
  'Overview',
  'Retail & Clinic',
  'Inventory',
  'Purchases & Factory',
  'Delivery & Courier',
  'CRM & Marketing',
  'HR & Payroll',
  'Finance & Cash',
  'Reports & Audit',
  'Settings',
];

const EXPECTED_HREFS = [
  '/dashboard',
  '/notifications',
  '/pos',
  '/sales',
  '/returns',
  '/staff/shifts',
  '/appointments',
  '/inventory',
  '/inventory/barcode-printing',
  '/categories',
  '/brands',
  '/stock-control',
  '/stock-control/adjust',
  '/stock-control/movements',
  '/stock-control/stock-takes',
  '/stock-control/low-stock',
  '/stock-control/valuation',
  '/suppliers/purchase-orders',
  '/suppliers',
  '/factory/raw-materials',
  '/factory/bom',
  '/factory',
  '/orders',
  '/delivery',
  '/delivery/failed',
  '/delivery/packaging',
  '/delivery/settings',
  '/delivery/rate-card',
  '/delivery/label',
  '/reports/recovery-staff-performance',
  '/customers',
  '/customers/broadcast',
  '/promotions',
  '/staff',
  '/staff/timeclock',
  '/staff/commissions',
  '/payroll',
  '/payroll/reports',
  '/expenses',
  '/petty-cash',
  '/expenses/cash-flow',
  '/payment-accounts',
  '/delivery/reconciliation',
  '/reports/profit-loss',
  '/reports/saved',
  '/settings/audit-log',
  '/settings/users',
  '/settings/hardware',
  '/settings/taxes',
  '/settings/payments',
  '/settings/store',
  '/settings/website',
  '/settings/account',
];

describe('store navigation', () => {
  it('uses the requested group order', () => {
    expect(storeNavGroups.map((group) => group.label)).toEqual(EXPECTED_GROUPS);
  });

  it('keeps every existing route exactly once', () => {
    const hrefs = storeNavGroups.flatMap((group) => group.items.map((item) => item.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of EXPECTED_HREFS) {
      expect(hrefs, `missing ${href}`).toContain(href);
    }
  });

  it('does not leave empty groups', () => {
    for (const group of storeNavGroups) {
      expect(group.items.length, `${group.label} is empty`).toBeGreaterThan(0);
    }
  });
});

describe('navigation icons', () => {
  const allItems: NavItem[] = storeNavGroups.flatMap((group) => group.items);

  it('gives every nav item an icon', () => {
    for (const item of allItems) {
      expect(item.icon, `${item.href} has no icon`).toBeTruthy();
    }
  });

  it('never reuses an icon, so each section stays recognisable', () => {
    const seen = new Map<unknown, string>();

    for (const item of allItems) {
      const previousHref = seen.get(item.icon);
      expect(previousHref, `${item.href} reuses the icon of ${previousHref}`).toBeUndefined();
      seen.set(item.icon, item.href);
    }
  });
});

describe('active nav item resolution', () => {
  const allItems: NavItem[] = storeNavGroups.flatMap((group) => group.items);

  it('resolves each documented route to its own item', () => {
    for (const href of EXPECTED_HREFS) {
      expect(resolveActiveNavHref(href, allItems), href).toBe(href);
    }
  });

  it('picks the most specific item on nested routes instead of the section', () => {
    // The regression: /inventory is a prefix of /inventory/barcode-printing.
    expect(resolveActiveNavHref('/inventory/barcode-printing', allItems)).toBe(
      '/inventory/barcode-printing',
    );
    expect(resolveActiveNavHref('/inventory', allItems)).toBe('/inventory');
    expect(resolveActiveNavHref('/stock-control/movements', allItems)).toBe(
      '/stock-control/movements',
    );
    expect(resolveActiveNavHref('/delivery/reconciliation', allItems)).toBe(
      '/delivery/reconciliation',
    );
  });

  it('does not highlight exact-match sections on child routes', () => {
    expect(resolveActiveNavHref('/dashboard/sales', allItems)).toBeNull();
    expect(resolveActiveNavHref('/customers/broadcast', allItems)).toBe(
      '/customers/broadcast',
    );
  });

  it('resolves deeper descendant routes to the owning nav item', () => {
    expect(resolveActiveNavHref('/settings/store/branding', allItems)).toBe('/settings/store');
    expect(resolveActiveNavHref('/inventory/barcode-printing/history', allItems)).toBe(
      '/inventory/barcode-printing',
    );
  });

  it('returns null when no item matches', () => {
    expect(resolveActiveNavHref('/unknown-route', allItems)).toBeNull();
  });
});
