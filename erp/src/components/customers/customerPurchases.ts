/**
 * Customer purchase-history totals (ARGUS #311).
 *
 * The Items column used to render `sale.lines.length`, i.e. the number of
 * distinct product lines. The label says Items and the rest of the module
 * counts units, so a sale with 3 x hair oil + 2 x churna showed "2" instead of
 * "5".
 */

export interface SaleLineQuantity {
  quantity: number;
}

export function saleItemCount(lines: readonly SaleLineQuantity[] | null | undefined): number {
  return (lines ?? []).reduce(
    (total, line) => total + (Number.isFinite(line.quantity) ? line.quantity : 0),
    0,
  );
}
