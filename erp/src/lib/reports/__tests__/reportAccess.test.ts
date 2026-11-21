import { describe, expect, it } from 'vitest';

import { getEffectivePermissions, PERMISSIONS } from '@/lib/constants/permissions';
import {
  canExportReports,
  canViewReportPage,
  reportPagePermission,
} from '@/lib/reports/reportAccess';
import { storeNavGroups } from '@/lib/navigation/store-nav';

/** ARGUS #438: page and export permissions must match the report. */
describe('report access', () => {
  it('maps P&L and Sales to their own report permissions', () => {
    expect(reportPagePermission('/reports/profit-loss')).toBe(
      PERMISSIONS.REPORT.viewProfitReport,
    );
    expect(reportPagePermission('/reports/sales')).toBe(
      PERMISSIONS.REPORT.viewSalesReport,
    );
    expect(reportPagePermission('/reports/unknown')).toBeNull();
  });

  it('checks the mapped page permission', () => {
    const owner = getEffectivePermissions('OWNER', []);
    expect(canViewReportPage('/reports/profit-loss', owner)).toBe(true);
    expect(canViewReportPage('/reports/sales', owner)).toBe(true);

    expect(
      canViewReportPage('/reports/profit-loss', [
        PERMISSIONS.REPORT.viewSalesReport,
      ]),
    ).toBe(false);
  });

  it('requires report:export rather than a view permission', () => {
    expect(canExportReports([PERMISSIONS.REPORT.viewSalesReport])).toBe(false);
    expect(canExportReports([PERMISSIONS.REPORT.exportReport])).toBe(true);
    expect(canExportReports(getEffectivePermissions('OWNER', []))).toBe(true);
  });

  it('points the sidebar P&L link at viewProfitReport', () => {
    const item = storeNavGroups
      .flatMap((group) => group.items)
      .find((entry) => entry.href === '/reports/profit-loss');

    expect(item?.permission).toBe(PERMISSIONS.REPORT.viewProfitReport);
  });
});
