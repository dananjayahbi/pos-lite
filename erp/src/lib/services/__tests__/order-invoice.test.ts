import { describe, expect, it } from 'vitest';

import { mapInvoiceLines, toNumber, type InvoiceLineSource } from '../order-invoice.service';

const dec = (value: number) => ({ toNumber: () => value });

function makeLine(overrides: Partial<InvoiceLineSource> = {}): InvoiceLineSource {
  return {
    sku: 'SKU-1',
    variantDescriptionSnapshot: 'Variant A',
    productNameSnapshot: 'Product',
    quantity: 2,
    unitPrice: dec(100),
    discountAmount: dec(10),
    lineTotalAfterDiscount: dec(190),
    ...overrides,
  };
}

describe('mapInvoiceLines', () => {
  it('returns an empty array for no lines', () => {
    expect(mapInvoiceLines([])).toEqual([]);
  });

  it('maps all line fields and converts Decimals to numbers', () => {
    const result = mapInvoiceLines([makeLine()]);
    expect(result).toEqual([
      {
        sku: 'SKU-1',
        description: 'Variant A',
        quantity: 2,
        unitPrice: 100,
        discountAmount: 10,
        lineTotal: 190,
      },
    ]);
  });

  it('falls back to product name when variant description is empty', () => {
    const result = mapInvoiceLines([makeLine({ variantDescriptionSnapshot: '' })]);
    expect(result[0]?.description).toBe('Product');
  });
});

describe('toNumber', () => {
  it('handles Decimal-like objects', () => {
    expect(toNumber(dec(42.5))).toBe(42.5);
  });

  it('handles plain numbers', () => {
    expect(toNumber(7)).toBe(7);
  });

  it('returns 0 for null/undefined', () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
  });
});
