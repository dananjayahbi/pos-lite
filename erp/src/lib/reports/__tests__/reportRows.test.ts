import { describe, expect, it } from 'vitest';

import {
  buildProfitLossExportRows,
  buildSalesExportRows,
} from '@/lib/reports/reportRows';
import { getReportDefinition } from '@/lib/reports/report-config';

function missingColumns(
  path: string,
  rows: Record<string, unknown>[],
): string[] {
  const columns = getReportDefinition(path)?.columns ?? [];
  return columns
    .map((column) => column.key)
    .filter((key) => !rows.some((row) => Object.hasOwn(row, key)));
}

describe('sales export parity (ARGUS #441)', () => {
  const data = {
    products: [
      {
        productName: 'Bhringraj Hair Oil',
        variantDescription: 'OIL / 100ml',
        unitsSold: 4,
        returnedUnits: 1,
        netUnits: 3,
        grossRevenue: '1000.00',
        returns: '250.00',
        netRevenue: '750.00',
        pctOfTotal: '75.00',
      },
      {
        productName: 'Brahmi Powder',
        variantDescription: '-',
        unitsSold: 1,
        returnedUnits: 0,
        netUnits: 1,
        grossRevenue: '250.00',
        returns: '0.00',
        netRevenue: '250.00',
        pctOfTotal: '25.00',
      },
    ],
    totals: {
      totalUnits: 5,
      totalReturnedUnits: 1,
      totalNetUnits: 4,
      grossRevenue: '1250.00',
      totalReturns: '250.00',
      netRevenue: '1000.00',
      pctOfTotal: '100.00',
    },
  };

  it('exports every visible column', () => {
    const rows = buildSalesExportRows(data);
    expect(missingColumns('/reports/sales', rows)).toEqual([]);
  });

  it('appends the grand-total row shown on screen', () => {
    const rows = buildSalesExportRows(data);
    const total = rows.at(-1);

    expect(total).toMatchObject({
      Product: 'Grand Total',
      'Units Sold': 5,
      'Returned Qty': 1,
      'Net Units': 4,
      'Net Revenue': '1000.00',
      '% of Total': '100.00',
    });
  });

  it('does not invent a totals row for an empty report', () => {
    const rows = buildSalesExportRows({
      products: [],
      totals: {
        totalUnits: 0,
        totalReturnedUnits: 0,
        totalNetUnits: 0,
        grossRevenue: '0.00',
        totalReturns: '0.00',
        netRevenue: '0.00',
      },
    });
    expect(rows).toEqual([]);
  });
});

describe('profit and loss export parity (ARGUS #441)', () => {
  const data = {
    totalReturns: '250.00',
    netRevenue: '9750.00',
    rawCOGS: '4000.00',
    returnedCOGS: '100.00',
    netCOGS: '3900.00',
    grossProfit: '5850.00',
    grossMargin: '60.0',
    totalExpenses: '2500.00',
    netProfit: '3350.00',
    netMargin: '34.4',
    revenueByPaymentMethod: [
      { method: 'CASH', total: '9000.00' },
      { method: 'LANKAQR', total: '750.00' },
    ],
    expenseCategories: [{ category: 'MISCELLANEOUS', total: '2500.00' }],
    cogsQuality: {
      usesFallback: false,
      caveats: [],
      sales: { snapshotCogs: 4000, fallbackCogs: 0, fallbackLines: 0, usesFallback: false },
      returned: { snapshotCogs: 100, fallbackCogs: 0, fallbackLines: 0, usesFallback: false },
    },
    monthlyData: [
      {
        month: '2026-10',
        revenue: '5000.00',
        cogs: '2000.00',
        grossProfit: '3000.00',
        expenses: '1000.00',
        netProfit: '2000.00',
        saleCount: 12,
      },
      {
        month: '2026-11',
        revenue: '4750.00',
        cogs: '1900.00',
        grossProfit: '2850.00',
        expenses: '1500.00',
        netProfit: '1350.00',
        saleCount: 10,
      },
    ],
  };

  it('exports every visible column', () => {
    const rows = buildProfitLossExportRows(data);
    expect(missingColumns('/reports/profit-loss', rows)).toEqual([]);
  });

  it('includes the displayed margins and friendly labels', () => {
    const rows = buildProfitLossExportRows(data);

    expect(rows.find((row) => row.Item === 'Gross Profit')).toMatchObject({
      Amount: '5850.00',
      'Margin %': '60.0%',
    });
    expect(rows.find((row) => row.Item === 'Net Profit')).toMatchObject({
      'Margin %': '34.4%',
    });
    expect(rows.find((row) => row.Item === 'LankaQR')).toMatchObject({
      Amount: '750.00',
    });
    expect(rows.find((row) => row.Item === 'Miscellaneous')).toMatchObject({
      Amount: '2500.00',
    });
  });

  it('includes the monthly table and a monthly total row', () => {
    const rows = buildProfitLossExportRows(data);
    const monthly = rows.filter((row) => row.Section === 'Monthly Trend');

    expect(monthly).toHaveLength(3);
    expect(monthly[0]).toMatchObject({ Item: 'Oct 26', Revenue: '5000.00', Sales: 12 });
    expect(monthly.at(-1)).toMatchObject({
      Item: 'Total (selected period)',
      Revenue: '9750.00',
      COGS: '3900.00',
      'Gross Profit': '5850.00',
      Expenses: '2500.00',
      'Net Profit': '3350.00',
      Sales: 22,
    });
  });
});
