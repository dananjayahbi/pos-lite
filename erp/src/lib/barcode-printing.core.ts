/**
 * Range labels for the Barcode Printing picker (ARGUS #158).
 *
 * The list is paginated by product but every visible row and every printed
 * label is a variant. Showing only a product range ("1-10 of 12") next to 17
 * variant rows made the operator think the count was wrong, so the label now
 * states both: the product range being shown and the variant rows within it.
 */

export interface BarcodeVariantRangeInput {
  firstProduct: number;
  lastProduct: number;
  totalProducts: number;
  variantsOnPage: number;
  totalVariants: number;
  /** True when a search narrows the rows, so "of N variants" would overstate. */
  narrowed?: boolean;
}

export function formatBarcodeVariantRange(input: BarcodeVariantRangeInput): string {
  const { firstProduct, lastProduct, totalProducts, variantsOnPage, totalVariants } = input;

  if (totalProducts <= 0) return 'No products';

  const products = `Products ${firstProduct}-${lastProduct} of ${totalProducts}`;
  const variants =
    input.narrowed || totalVariants <= 0
      ? `${variantsOnPage} matching variant${variantsOnPage === 1 ? '' : 's'}`
      : `${variantsOnPage} of ${totalVariants} variants`;

  return `${products} · ${variants}`;
}

/** Product page label, e.g. "Products page 1 of 2". */
export function formatBarcodeProductPage(page: number, totalPages: number): string {
  return `Products page ${page} of ${totalPages}`;
}

/**
 * A label may only print a real saved barcode (ARGUS #163). The old flow
 * substituted the SKU whenever `barcode` was empty, producing a Code 128 symbol
 * that scanned as the SKU and looked like the product's catalogue barcode.
 * The picker blocks those variants and the label marks itself "SKU only".
 */
export function hasPrintableBarcode(
  value: string | null | undefined,
): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
