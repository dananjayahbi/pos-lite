import { describe, expect, it } from 'vitest';

import {
  filterSnapshotColumns,
  savedReportPermission,
  savedReportSnapshotMeta,
  SAVED_REPORT_SNAPSHOT_KEY,
} from '@/lib/reports/savedReportAccess.core';
import { PERMISSIONS } from '@/lib/constants/permissions';

/** ARGUS #446: saved reports are authorized per report type, not one broad key. */
describe('savedReportPermission', () => {
  it('maps each report type to its own report permission', () => {
    expect(savedReportPermission('profit-loss')).toBe(PERMISSIONS.REPORT.viewProfitReport);
    expect(savedReportPermission('/reports/inventory-valuation')).toBe(
      PERMISSIONS.REPORT.viewStockReport,
    );
    expect(savedReportPermission('customer-analytics')).toBe(
      PERMISSIONS.REPORT.viewCustomerReport,
    );
    expect(savedReportPermission('zero-value-sales')).toBe(
      PERMISSIONS.REPORT.viewZeroValueReport,
    );
    expect(savedReportPermission('sales')).toBe(PERMISSIONS.REPORT.viewSalesReport);
  });

  it('falls back to the sales report permission for unknown types', () => {
    expect(savedReportPermission('not-a-report')).toBe(PERMISSIONS.REPORT.viewSalesReport);
    expect(savedReportPermission(null)).toBe(PERMISSIONS.REPORT.viewSalesReport);
  });
});

describe('savedReportSnapshotMeta', () => {
  it('reads the snapshot as-of/source labels', () => {
    expect(
      savedReportSnapshotMeta({
        [SAVED_REPORT_SNAPSHOT_KEY]: { asOf: '2026-11-21T10:00:00.000Z', source: 'CLIENT' },
      }),
    ).toEqual({ asOf: '2026-11-21T10:00:00.000Z', source: 'CLIENT' });
  });

  it('returns nulls for legacy rows without snapshot metadata', () => {
    expect(savedReportSnapshotMeta({ from: '2026-11-01' })).toEqual({ asOf: null, source: null });
    expect(savedReportSnapshotMeta(null)).toEqual({ asOf: null, source: null });
  });
});

describe('filterSnapshotColumns', () => {
  const server = [{ key: 'Product' }, { key: 'Units Sold' }];

  it('keeps only server-defined columns', () => {
    expect(
      filterSnapshotColumns(
        [{ key: 'Product' }, { key: 'Injected' }, { key: 'Units Sold' }],
        server,
      ),
    ).toEqual([{ key: 'Product' }, { key: 'Units Sold' }]);
  });

  it('can return an empty list so the caller falls back to server columns', () => {
    expect(filterSnapshotColumns([{ key: 'Injected' }], server)).toEqual([]);
  });
});
