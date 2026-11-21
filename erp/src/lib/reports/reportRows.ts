/**
 * Export row builders (ARGUS #441).
 *
 * The downloaded file must mirror the visible report: every displayed column,
 * the margin text and the totals row. The builders live here rather than inside
 * the page components so the parity can be unit-tested against the registry.
 */

import type { ReportRow } from "@/lib/reports/export";
import { expenseCategoryLabel, reportMonthLabel } from "@/lib/reports/labels";
import { paymentMethodLabel } from "@/lib/sales/payment-method-label";

export interface SalesExportRow {
  productName: string;
  variantDescription: string;
  unitsSold: number;
  returnedUnits: number;
  netUnits: number;
  grossRevenue: string;
  returns: string;
  netRevenue: string;
  pctOfTotal: string;
}

export interface SalesExportInput {
  products: SalesExportRow[];
  totals: {
    totalUnits: number;
    totalReturnedUnits: number;
    totalNetUnits: number;
    grossRevenue: string;
    totalReturns: string;
    netRevenue: string;
    pctOfTotal?: string;
  };
}

export function buildSalesExportRows(data: SalesExportInput): ReportRow[] {
  const rows: ReportRow[] = data.products.map((p) => ({
    Product: p.productName,
    Variant: p.variantDescription,
    "Units Sold": p.unitsSold,
    "Returned Qty": p.returnedUnits,
    "Net Units": p.netUnits,
    "Gross Revenue": p.grossRevenue,
    Returns: p.returns,
    "Net Revenue": p.netRevenue,
    "% of Total": p.pctOfTotal,
  }));

  if (rows.length > 0) {
    rows.push({
      Product: "Grand Total",
      Variant: "",
      "Units Sold": data.totals.totalUnits,
      "Returned Qty": data.totals.totalReturnedUnits,
      "Net Units": data.totals.totalNetUnits,
      "Gross Revenue": data.totals.grossRevenue,
      Returns: data.totals.totalReturns,
      "Net Revenue": data.totals.netRevenue,
      "% of Total": data.totals.pctOfTotal ?? "100.00",
    });
  }

  return rows;
}

export interface ProfitLossExportInput {
  totalReturns: string;
  netRevenue: string;
  rawCOGS: string;
  returnedCOGS: string;
  netCOGS: string;
  grossProfit: string;
  grossMargin: string;
  totalExpenses: string;
  netProfit: string;
  netMargin: string;
  revenueByPaymentMethod: Array<{ method: string; total: string }>;
  expenseCategories: Array<{ category: string; total: string }>;
  cogsQuality: {
    usesFallback: boolean;
    caveats: string[];
    sales: { snapshotCogs: number; fallbackCogs: number; fallbackLines: number; usesFallback: boolean };
    returned: { snapshotCogs: number; fallbackCogs: number; fallbackLines: number; usesFallback: boolean };
  };
  monthlyData: Array<{
    month: string;
    revenue: string;
    cogs: string;
    grossProfit: string;
    expenses: string;
    netProfit: string;
    saleCount: number;
  }>;
}

export function buildProfitLossExportRows(data: ProfitLossExportInput): ReportRow[] {
  const rows: ReportRow[] = [];

  // Revenue section
  for (const r of data.revenueByPaymentMethod) {
    rows.push({
      Section: "Revenue",
      Item: paymentMethodLabel(r.method),
      Amount: r.total,
    });
  }
  rows.push({
    Section: "Revenue",
    Item: "Less: Returns",
    Amount: `-${data.totalReturns}`,
  });
  rows.push({
    Section: "Revenue",
    Item: "Net Revenue",
    Amount: data.netRevenue,
  });

  // COGS, including the displayed snapshot/current-cost split
  if (data.cogsQuality.sales.usesFallback) {
    rows.push({
      Section: "COGS",
      Item: "COGS - snapshot cost",
      Amount: data.cogsQuality.sales.snapshotCogs.toFixed(2),
    });
    rows.push({
      Section: "COGS",
      Item: `COGS - current-cost fallback (${data.cogsQuality.sales.fallbackLines} lines)`,
      Amount: data.cogsQuality.sales.fallbackCogs.toFixed(2),
    });
  }
  rows.push({ Section: "COGS", Item: "Cost of Goods Sold", Amount: data.rawCOGS });
  if (data.cogsQuality.returned.usesFallback) {
    rows.push({
      Section: "COGS",
      Item: "Returned COGS - snapshot cost",
      Amount: `-${data.cogsQuality.returned.snapshotCogs.toFixed(2)}`,
    });
    rows.push({
      Section: "COGS",
      Item: `Returned COGS - current-cost fallback (${data.cogsQuality.returned.fallbackLines} lines)`,
      Amount: `-${data.cogsQuality.returned.fallbackCogs.toFixed(2)}`,
    });
  }
  rows.push({
    Section: "COGS",
    Item: "Less: Returned COGS",
    Amount: `-${data.returnedCOGS}`,
  });
  rows.push({ Section: "COGS", Item: "Net COGS", Amount: data.netCOGS });
  if (data.cogsQuality.usesFallback) {
    rows.push({
      Section: "COGS",
      Item: "COGS source warning",
      Amount: data.cogsQuality.caveats.join(" "),
    });
  }

  rows.push({
    Section: "Profit",
    Item: "Gross Profit",
    Amount: data.grossProfit,
    "Margin %": `${data.grossMargin}%`,
  });

  // Expenses
  for (const e of data.expenseCategories) {
    rows.push({
      Section: "Expenses",
      Item: expenseCategoryLabel(e.category),
      Amount: e.total,
    });
  }
  rows.push({
    Section: "Expenses",
    Item: "Total Expenses",
    Amount: data.totalExpenses,
  });

  rows.push({
    Section: "Profit",
    Item: "Net Profit",
    Amount: data.netProfit,
    "Margin %": `${data.netMargin}%`,
  });

  // Monthly detail table
  const totals = {
    revenue: 0,
    cogs: 0,
    grossProfit: 0,
    expenses: 0,
    netProfit: 0,
    saleCount: 0,
  };
  for (const month of data.monthlyData) {
    totals.revenue += parseFloat(month.revenue) || 0;
    totals.cogs += parseFloat(month.cogs) || 0;
    totals.grossProfit += parseFloat(month.grossProfit) || 0;
    totals.expenses += parseFloat(month.expenses) || 0;
    totals.netProfit += parseFloat(month.netProfit) || 0;
    totals.saleCount += month.saleCount;

    rows.push({
      Section: "Monthly Trend",
      Item: reportMonthLabel(month.month),
      Revenue: month.revenue,
      COGS: month.cogs,
      "Gross Profit": month.grossProfit,
      Expenses: month.expenses,
      "Net Profit": month.netProfit,
      Sales: month.saleCount,
    });
  }
  if (data.monthlyData.length > 0) {
    rows.push({
      Section: "Monthly Trend",
      Item: "Total (selected period)",
      Revenue: totals.revenue.toFixed(2),
      COGS: totals.cogs.toFixed(2),
      "Gross Profit": totals.grossProfit.toFixed(2),
      Expenses: totals.expenses.toFixed(2),
      "Net Profit": totals.netProfit.toFixed(2),
      Sales: totals.saleCount,
    });
  }

  return rows;
}
