/**
 * Low Stock dashboard card note (ARGUS #46).
 *
 * The card used to show an open-shift time with no date, which was unrelated to
 * stock and could be days old. The note now describes the stock state.
 */
export function lowStockCardSubtitle(count: number): string {
  if (count <= 0) return 'All variants adequately stocked';
  if (count === 1) return '1 variant at or below threshold';
  return `${count} variants at or below threshold`;
}
