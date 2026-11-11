import { describe, it, expect } from 'vitest';

import { storeNavGroups } from '@/lib/navigation/store-nav';

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
