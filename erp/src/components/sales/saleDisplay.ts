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
