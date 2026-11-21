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
}

export function formatBarcodeVariantRange(input: BarcodeVariantRangeInput): string {
  const { firstProduct, lastProduct, totalProducts, variantsOnPage, totalVariants } = input;

  if (totalProducts <= 0) return 'No products';

  const products = `Products ${firstProduct}-${lastProduct} of ${totalProducts}`;
  const variants =
    totalVariants > 0
      ? `${variantsOnPage} of ${totalVariants} variants`
      : `${variantsOnPage} variant${variantsOnPage === 1 ? '' : 's'}`;

  return `${products} · ${variants}`;
}

/** Product page label, e.g. "Products page 1 of 2". */
export function formatBarcodeProductPage(page: number, totalPages: number): string {
  return `Products page ${page} of ${totalPages}`;
}
