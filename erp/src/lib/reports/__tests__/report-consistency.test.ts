/**
 * Reconciliation and boundary coverage for the Sales & Profit reports
 * (ARGUS #443).
 *
 * The helper-only suite could not catch a P&L/Sales disagreement, a header-only
 * sale, a missing cost snapshot, a monthly row outside the period, an export
 * mismatch or the 100.01% rounding. These cases assert the rules that tie the
 * two reports together.
 */

import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';

import { netProductRevenue, netRefundAmount } from '@/lib/reports/accounting';
import { summarizeCogsSource } from '@/lib/reports/cogsSource';
import { filterMonthKeysInPeriod } from '@/lib/reports/monthlyPeriod';
import {
  canExportReports,
  canViewReportPage,
} from '@/lib/reports/reportAccess';
import { getReportDefinition } from '@/lib/reports/report-config';
import {
  buildProfitLossExportRows,
  buildSalesExportRows,
} from '@/lib/reports/reportRows';
import { allocatePercentOfTotal, netUnitsSold } from '@/lib/reports/sales-report';
import { PERMISSIONS } from '@/lib/constants/permissions';

describe('Sales vs Profit & Loss reconciliation (ARGUS #443)', () => {
  // One sale: subtotal 9,500, cart discount 500. One line returned: the line
  // refund is 1,000 before the original cart discount.
  const sale = { subtotal: '9500.00', discountAmount: '500.00' };
  const lineRefund = '1000.00';

  const salesGross = netProductRevenue(sale);
  const salesReturn = netRefundAmount(lineRefund, sale.subtotal, sale.discountAmount);
  const salesNet = new Decimal(salesGross).minus(salesReturn);

  it('nets the same revenue and returns on both reports', () => {
    // Sales by Product: per-line after-discount totals minus net refunds.
    // P&L: (subtotal - cart discount) minus the same net refunds.
    const pnlGross = netProductRevenue(sale);
    const pnlReturn = netRefundAmount(lineRefund, sale.subtotal, sale.discountAmount);

    expect(pnlGross).toBe(salesGross);
    expect(pnlReturn.toFixed(2)).toBe(salesReturn.toFixed(2));
    expect(
      new Decimal(pnlGross).minus(pnlReturn).toFixed(2),
    ).toBe(salesNet.toFixed(2));
  });

  it('applies the original cart-discount ratio to refunds', () => {
    // 9500/9500 paid ratio is not 1 when the sale carried a discount.
    expect(netRefundAmount('1000.00', '9500.00', '500.00').toFixed(2)).toBe(
      '947.37',
    );
    // A zero-subtotal sale keeps the refund as recorded instead of NaN.
    expect(netRefundAmount('250.00', '0.00', '0.00').toFixed(2)).toBe('250.00');
  });

  it('reports net units as sold minus returned', () => {
    expect(netUnitsSold(10, 3)).toBe(7);
    expect(netUnitsSold(0, 0)).toBe(0);
  });
});

describe('header-only and empty reports (ARGUS #443)', () => {
  const emptyTotals = {
    totalUnits: 0,
    totalReturnedUnits: 0,
    totalNetUnits: 0,
    grossRevenue: '0.00',
    totalReturns: '0.00',
    netRevenue: '0.00',
    pctOfTotal: '0.00',
  };

  it('exports no rows and no invented total for an empty report', () => {
    expect(buildSalesExportRows({ products: [], totals: emptyTotals })).toEqual([]);
  });

  it('allocates 0.00% without dividing by a zero total', () => {
    const allocation = allocatePercentOfTotal(['0.00', '0.00']);
    expect(allocation.percents).toEqual(['0.00', '0.00']);
    expect(allocation.total).toBe('0.00');
  });
});

describe('missing cost snapshots (ARGUS #443)', () => {
  it('flags a report that fell back to current cost', () => {
    const summary = summarizeCogsSource({
      snapshotCogs: '0.00',
      fallbackCogs: '1200.00',
      snapshotLines: 0,
      fallbackLines: 2,
    });

    expect(summary.usesFallback).toBe(true);
    expect(summary.fallbackPercent).toBe(100);
    expect(summary.caveat).toContain('current-cost fallback');
  });

  it('stays quiet when every line captured a snapshot', () => {
    const summary = summarizeCogsSource({
      snapshotCogs: '1200.00',
      fallbackCogs: '0.00',
      snapshotLines: 2,
      fallbackLines: 0,
    });

    expect(summary.usesFallback).toBe(false);
    expect(summary.caveat).toBeNull();
  });
});

describe('monthly detail stays inside the selected range (ARGUS #443)', () => {
  const keys = ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];

  it('keeps a single-month statement to that month', () => {
    expect(
      filterMonthKeysInPeriod(
        keys,
        new Date(2026, 8, 1),
        new Date(2026, 8, 30),
      ),
    ).toEqual(['2026-09']);
  });

  it('returns nothing for a reversed range', () => {
    expect(
      filterMonthKeysInPeriod(
        keys,
        new Date(2030, 11, 31),
        new Date(2024, 0, 1),
      ),
    ).toEqual([]);
  });
});

describe('permissions and export columns (ARGUS #443)', () => {
  it('requires the report-specific view permission', () => {
    expect(
      canViewReportPage('/reports/sales', [PERMISSIONS.REPORT.viewSalesReport]),
    ).toBe(true);
    expect(
      canViewReportPage('/reports/sales', [PERMISSIONS.REPORT.viewProfitReport]),
    ).toBe(false);
    expect(canViewReportPage('/reports/unknown', [])).toBe(false);
  });

  it('treats export as a separate capability', () => {
    expect(canExportReports([PERMISSIONS.REPORT.exportReport])).toBe(true);
    expect(canExportReports([PERMISSIONS.REPORT.viewSalesReport])).toBe(false);
  });

  it('registers the returned-quantity and margin columns the screens show', () => {
    const salesColumns = (getReportDefinition('/reports/sales')?.columns ?? []).map(
      (column) => column.header,
    );
    expect(salesColumns).toContain('Returned Qty');
    expect(salesColumns).toContain('Net Units');

    const pnlColumns = (
      getReportDefinition('/reports/profit-loss')?.columns ?? []
    ).map((column) => column.header);
    expect(pnlColumns).toContain('Margin %');
    expect(pnlColumns).toContain('Revenue');
    expect(pnlColumns).toContain('Sales');
  });

  it('builds a P&L export with a margin row and a monthly total', () => {
    const rows = buildProfitLossExportRows({
      totalReturns: '0.00',
      netRevenue: '1000.00',
      rawCOGS: '1000.00',
      returnedCOGS: '0.00',
      netCOGS: '1000.00',
      grossProfit: '0.00',
      grossMargin: '0.0',
      totalExpenses: '0.00',
      netProfit: '0.00',
      netMargin: '0.0',
      revenueByPaymentMethod: [],
      expenseCategories: [],
      cogsQuality: {
        usesFallback: false,
        caveats: [],
        sales: { snapshotCogs: 0, fallbackCogs: 0, fallbackLines: 0, usesFallback: false },
        returned: { snapshotCogs: 0, fallbackCogs: 0, fallbackLines: 0, usesFallback: false },
      },
      monthlyData: [
        {
          month: '2026-09',
          revenue: '1000.00',
          cogs: '1000.00',
          grossProfit: '0.00',
          expenses: '0.00',
          netProfit: '0.00',
          saleCount: 1,
        },
      ],
    });

    expect(rows.find((row) => row.Item === 'Gross Profit')?.['Margin %']).toBe(
      '0.0%',
    );
    expect(rows.at(-1)).toMatchObject({
      Section: 'Monthly Trend',
      Item: 'Total (selected period)',
      Revenue: '1000.00',
      Sales: 1,
    });
  });
});

describe('rounded percentages reconcile (ARGUS #443)', () => {
  it('turns the 100.01% seed rows into exactly 100.00%', () => {
    const { percents, total } = allocatePercentOfTotal([
      3320, 2292, 1079, 887, 877, 670, 475, 206, 195, 0,
    ]);

    expect(total).toBe('100.00');
    // Compare hundredths so float addition cannot hide a 0.01 drift.
    expect(
      percents.reduce((acc, value) => acc + Math.round(Number(value) * 100), 0),
    ).toBe(10000);
  });
});
