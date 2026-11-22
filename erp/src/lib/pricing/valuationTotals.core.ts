/**
 * Valuation totals derived from the category table (ARGUS #220).
 *
 * The endpoint used to compute the KPI totals from one pass and the category
 * breakdown from another. Both came from the same query, but the two
 * accumulators could drift on a future edit, and no totals row existed to expose
 * it. Totals are now the column sums of the breakdown the table and CSV render,
 * so the cards cannot disagree with the rows beneath them.
 */

import Decimal from 'decimal.js';

export interface ValuationBreakdownTotalsInput {
  variantCount: number;
  retailValue: number;
  vatAmount: number;
  ssclAmount: number;
  taxAmount: number;
  retailValueInclTax: number;
  costValue: number;
}

export interface ValuationBreakdownTotals {
  variantCount: number;
  retailValue: string;
  vatAmount: string;
  ssclAmount: string;
  taxAmount: string;
  retailValueInclTax: string;
  costValue: string;
}

function sumField(
  rows: ValuationBreakdownTotalsInput[],
  field: Exclude<keyof ValuationBreakdownTotalsInput, 'variantCount'>,
): Decimal {
  return rows
    .reduce((sum, row) => sum.plus(row[field]), new Decimal(0))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function sumValuationBreakdown(
  rows: ValuationBreakdownTotalsInput[],
): ValuationBreakdownTotals {
  return {
    variantCount: rows.reduce((sum, row) => sum + row.variantCount, 0),
    retailValue: sumField(rows, 'retailValue').toFixed(2),
    vatAmount: sumField(rows, 'vatAmount').toFixed(2),
    ssclAmount: sumField(rows, 'ssclAmount').toFixed(2),
    taxAmount: sumField(rows, 'taxAmount').toFixed(2),
    retailValueInclTax: sumField(rows, 'retailValueInclTax').toFixed(2),
    costValue: sumField(rows, 'costValue').toFixed(2),
  };
}

/**
 * ARGUS #222: "Variants in Stock" counts variants holding units, not every live
 * variant. A sold-out variant carries no value, so including it made the label
 * and the arithmetic diverge as soon as one variant hit zero.
 */
export function isVariantInStock(stockQuantity: number): boolean {
  return Number.isFinite(stockQuantity) && stockQuantity > 0;
}
