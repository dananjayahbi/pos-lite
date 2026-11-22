/**
 * Shared Sales-ledger display counts.
 *
 * A sale row is one or more lines, and each line carries a quantity. The
 * "Items" column used to show `lines.length`, so a single line with quantity 2
 * read as one item (ARGUS #81). Unit counts are what an operator reconciles
 * against stock, so the column now sums the quantities and the line count is
 * available separately for the detail surfaces.
 */

export interface SaleLineQuantity {
  quantity: number;
}

/** Total units sold on a sale (sum of line quantities). */
export function saleUnitCount(lines: readonly SaleLineQuantity[]): number {
  return lines.reduce(
    (sum, line) => sum + (Number.isFinite(line.quantity) ? line.quantity : 0),
    0,
  );
}

/** Number of distinct sale lines (the old "Items" value). */
export function saleLineCount(lines: readonly SaleLineQuantity[]): number {
  return lines.length;
}

export interface SaleEmptyStateInput {
  preset: string;
  hasStatusFilter: boolean;
  hasPaymentFilter: boolean;
}

/**
 * Empty-state copy for the Sales ledger (ARGUS #84).
 *
 * The page opens on Today, so a store whose sales are all older saw the generic
 * "No sales found" and could not tell that a date range was hiding them. The
 * active range is now named and the operator is told how to widen it.
 */
export function saleEmptyState({
  preset,
  hasStatusFilter,
  hasPaymentFilter,
}: SaleEmptyStateInput): { title: string; hint: string } {
  if (hasStatusFilter || hasPaymentFilter) {
    return {
      title: 'No sales match these filters',
      hint: 'Try clearing a filter or widening the date range.',
    };
  }
  if (preset === 'today') {
    return {
      title: 'No sales today',
      hint: 'The ledger opens on today. Choose This month, Last month or a custom range to see older sales.',
    };
  }
  return {
    title: 'No sales in this date range',
    hint: 'Choose a wider range, or Reset to return to today.',
  };
}
