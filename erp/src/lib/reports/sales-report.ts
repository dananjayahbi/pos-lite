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
  return variant && variant !== "—"
    ? `${row.productName} - ${variant}`
    : row.productName;
}

/** Units actually kept by customers (sold minus returned in the period). */
export function netUnitsSold(sold: number, returned: number): number {
  return sold - returned;
}
