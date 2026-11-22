import { describe, expect, it } from 'vitest';

import {
  formatBarcodeProductPage,
  formatBarcodeVariantRange,
  hasPrintableBarcode,
} from '@/lib/barcode-printing.core';

/** ARGUS #158: the range must describe products and variant rows separately. */
describe('barcode printing range labels', () => {
  it('shows the product range and the variant rows on the page', () => {
    expect(
      formatBarcodeVariantRange({
        firstProduct: 1,
        lastProduct: 10,
        totalProducts: 12,
        variantsOnPage: 17,
        totalVariants: 23,
      }),
    ).toBe('Products 1-10 of 12 · 17 of 23 variants');
  });

  it('handles the final partial product page', () => {
    expect(
      formatBarcodeVariantRange({
        firstProduct: 11,
        lastProduct: 12,
        totalProducts: 12,
        variantsOnPage: 6,
        totalVariants: 23,
      }),
    ).toBe('Products 11-12 of 12 · 6 of 23 variants');
  });

  it('falls back to matching variants when the API has no variant total', () => {
    expect(
      formatBarcodeVariantRange({
        firstProduct: 1,
        lastProduct: 3,
        totalProducts: 3,
        variantsOnPage: 5,
        totalVariants: 0,
      }),
    ).toBe('Products 1-3 of 3 · 5 matching variants');

    expect(
      formatBarcodeVariantRange({
        firstProduct: 1,
        lastProduct: 1,
        totalProducts: 1,
        variantsOnPage: 1,
        totalVariants: 1,
      }),
    ).toBe('Products 1-1 of 1 · 1 of 1 variants');
  });

  it('reports matching variants while a search narrows the rows (ARGUS #159)', () => {
    expect(
      formatBarcodeVariantRange({
        firstProduct: 1,
        lastProduct: 1,
        totalProducts: 1,
        variantsOnPage: 1,
        totalVariants: 3,
        narrowed: true,
      }),
    ).toBe('Products 1-1 of 1 · 1 matching variant');
  });

  it('reports an empty catalogue', () => {
    expect(
      formatBarcodeVariantRange({
        firstProduct: 0,
        lastProduct: 0,
        totalProducts: 0,
        variantsOnPage: 0,
        totalVariants: 0,
      }),
    ).toBe('No products');
  });

  it('labels the product pagination explicitly', () => {
    expect(formatBarcodeProductPage(1, 2)).toBe('Products page 1 of 2');
    expect(formatBarcodeProductPage(2, 2)).toBe('Products page 2 of 2');
  });
});

/** ARGUS #163: a missing barcode must never be replaced by the SKU. */
describe('barcode printability', () => {
  it('accepts a real saved barcode', () => {
    expect(hasPrintableBarcode('2003424422401')).toBe(true);
    expect(hasPrintableBarcode('  ABC-1  ')).toBe(true);
  });

  it('rejects missing, blank and non-string values', () => {
    expect(hasPrintableBarcode(null)).toBe(false);
    expect(hasPrintableBarcode(undefined)).toBe(false);
    expect(hasPrintableBarcode('   ')).toBe(false);
    expect(hasPrintableBarcode('')).toBe(false);
  });
});
