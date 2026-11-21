/**
 * Chart label for a sales-report row. Product rows are per variant, so the
 * variant must be part of the label or three rows of the same product render as
 * indistinguishable bars.
 */
export function salesProductLabel(row: {
  productName: string;
  variantDescription?: string | null;
}): string {
  const variant = row.variantDescription?.trim();
  return variant && variant !== "-"
    ? `${row.productName} - ${variant}`
    : row.productName;
}

/** Units actually kept by customers (sold minus returned in the period). */
export function netUnitsSold(sold: number, returned: number): number {
  return sold - returned;
}

function toAmount(value: string | number): number {
  const num = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(num) ? num : 0;
}

/**
 * ARGUS #439 - percentages of a total that reconcile to the footer.
 *
 * Rounding each row independently made the default Sales by Product rows sum to
 * 100.01% while the footer hardcoded 100%. The largest-remainder method assigns
 * whole hundredths of a percent and gives the remaining hundredths to the rows
 * with the largest rounding loss, so the displayed values always add up to the
 * displayed total.
 *
 * Negative rows (returns above sales) make a percentage-of-total meaningless,
 * so mixed-sign and zero totals keep the plain per-row rounding and report the
 * rounded sum instead of forcing 100.
 */
export function allocatePercentOfTotal(values: Array<string | number>): {
  percents: string[];
  total: string;
} {
  const amounts = values.map(toAmount);
  const sum = amounts.reduce((acc, value) => acc + value, 0);
  const allNonNegative = amounts.every((value) => value >= 0);

  if (!allNonNegative || sum <= 0) {
    const percents = amounts.map((value) =>
      sum === 0 ? "0.00" : ((value / sum) * 100).toFixed(2),
    );
    const total = percents.reduce((acc, value) => acc + toAmount(value), 0);
    return { percents, total: total.toFixed(2) };
  }

  // Work in hundredths of a percent so the result has exactly two decimals.
  const exact = amounts.map((value) => (value / sum) * 10_000);
  const floors = exact.map((value) => Math.floor(value));
  let remaining = 10_000 - floors.reduce((acc, value) => acc + value, 0);

  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  for (const entry of order) {
    if (remaining <= 0) break;
    floors[entry.index] = (floors[entry.index] ?? 0) + 1;
    remaining -= 1;
  }

  const percents = floors.map((value) => (value / 100).toFixed(2));
  return { percents, total: "100.00" };
}

/**
 * Rows worth charting: a zero-revenue variant is not a "top product" and drew a
 * 0-width bar beside real revenue (ARGUS #439). Returns at most `limit` rows.
 */
export function topRevenueProducts<T extends { netRevenue: string | number }>(
  products: T[],
  limit = 10,
): T[] {
  return products
    .filter((product) => toAmount(product.netRevenue) > 0)
    .sort((a, b) => toAmount(b.netRevenue) - toAmount(a.netRevenue))
    .slice(0, limit);
}
