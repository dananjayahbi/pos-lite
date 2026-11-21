/**
 * Stock Valuation CSV (ARGUS #223).
 *
 * The page caches valuation for five minutes but Export called the endpoint
 * live, so a download could disagree with the cards. Both sides now build the
 * file from the same snapshot object: the client passes the data it rendered,
 * the server passes the data it just computed. The file also states its "as of"
 * timestamp and the filename carries the time, not just the date.
 */

import Decimal from 'decimal.js';

import { csvCell } from '@/lib/export';
import { valuationMarginPercent } from '@/lib/pricing/valuation-tax.core';
import { VALUATION_COST_BASIS_NOTE } from '@/lib/pricing/valuationBasis';

export interface ValuationCsvCategoryRow {
  categoryName: string;
  variantCount: number;
  retailValue: number;
  taxAmount: number;
  retailValueInclTax: number;
  costValue: number;
}

export interface ValuationCsvSnapshot {
  retailValue: number;
  vatAmount: number;
  ssclAmount: number;
  taxAmount: number;
  retailValueInclTax: number;
  taxRates: { vatRate: number; ssclRate: number };
  costValue: number;
  rawMaterialValue: number;
  totalCostValue: number;
  estimatedMargin: number;
  estimatedMarginPercent: number;
  variantCount: number;
  categoryBreakdown: ValuationCsvCategoryRow[];
  calculatedAt: string;
}

export function buildValuationCsv(snapshot: ValuationCsvSnapshot): string {
  const retailValue = new Decimal(snapshot.retailValue);
  const lines: string[] = [];

  lines.push('Stock Valuation Summary');
  lines.push(`As of,${csvCell(snapshot.calculatedAt)}`);
  lines.push('Metric,Value');
  lines.push(`Total Retail Value (Excl. Tax),${csvCell(snapshot.retailValue.toFixed(2))}`);
  lines.push(`VAT (${snapshot.taxRates.vatRate}%),${csvCell(snapshot.vatAmount.toFixed(2))}`);
  if (snapshot.taxRates.ssclRate > 0 || snapshot.ssclAmount > 0) {
    lines.push(`SSCL (${snapshot.taxRates.ssclRate}%),${csvCell(snapshot.ssclAmount.toFixed(2))}`);
  }
  lines.push(`Total Retail Value (Incl. Tax),${csvCell(snapshot.retailValueInclTax.toFixed(2))}`);
  lines.push(`Total Cost Value (At Current Cost),${csvCell(snapshot.costValue.toFixed(2))}`);
  lines.push(`Raw Material Value,${csvCell(snapshot.rawMaterialValue.toFixed(2))}`);
  lines.push(`Total Inventory Cost Value,${csvCell(snapshot.totalCostValue.toFixed(2))}`);
  // ARGUS #218: the figure is a current-cost snapshot, not acquisition cost.
  lines.push(`Cost Basis,${csvCell(VALUATION_COST_BASIS_NOTE)}`);
  lines.push(`Estimated Margin (Rs.),${csvCell(snapshot.estimatedMargin.toFixed(2))}`);
  lines.push(`Estimated Margin (%),${csvCell(snapshot.estimatedMarginPercent.toFixed(2))}`);
  lines.push('');
  lines.push('Category Breakdown');
  lines.push(
    'Category,Variants in Stock,Retail Value Excl. Tax (Rs.),Tax (Rs.),Retail Value Incl. Tax (Rs.),Cost Value - At Current Cost (Rs.),Margin %,Share of Total',
  );

  let totalRetail = new Decimal(0);
  let totalTax = new Decimal(0);
  let totalInclTax = new Decimal(0);
  let totalCost = new Decimal(0);
  let totalVariants = 0;

  for (const category of snapshot.categoryBreakdown) {
    const share = retailValue.greaterThan(0)
      ? new Decimal(category.retailValue).div(retailValue).times(100)
      : new Decimal(0);

    totalRetail = totalRetail.plus(category.retailValue);
    totalTax = totalTax.plus(category.taxAmount);
    totalInclTax = totalInclTax.plus(category.retailValueInclTax);
    totalCost = totalCost.plus(category.costValue);
    totalVariants += category.variantCount;

    lines.push(
      [
        csvCell(category.categoryName),
        csvCell(category.variantCount),
        csvCell(category.retailValue.toFixed(2)),
        csvCell(category.taxAmount.toFixed(2)),
        csvCell(category.retailValueInclTax.toFixed(2)),
        csvCell(category.costValue.toFixed(2)),
        csvCell(valuationMarginPercent(category.retailValue, category.costValue).toFixed(2)),
        csvCell(share.toFixed(2)),
      ].join(','),
    );
  }

  lines.push(
    [
      csvCell('Total'),
      csvCell(totalVariants),
      csvCell(totalRetail.toFixed(2)),
      csvCell(totalTax.toFixed(2)),
      csvCell(totalInclTax.toFixed(2)),
      csvCell(totalCost.toFixed(2)),
      csvCell(valuationMarginPercent(totalRetail, totalCost).toFixed(2)),
      csvCell(retailValue.greaterThan(0) ? '100.00' : '0.00'),
    ].join(','),
  );

  return lines.join('\n');
}

/**
 * `stock-valuation-2026-11-22-0504.csv` (UTC, from the snapshot timestamp).
 * A date-only filename let two exports from the same day silently differ.
 */
export function valuationCsvFilename(calculatedAt: string): string {
  const date = new Date(calculatedAt);
  if (Number.isNaN(date.getTime())) {
    return 'stock-valuation.csv';
  }
  const stamp = date.toISOString().slice(0, 16).replace('T', '-').replace(':', '');
  return `stock-valuation-${stamp}.csv`;
}
