import { describe, expect, it } from 'vitest';

import {
  mapDeliveryInvoiceLines,
  mapInvoiceLines,
  mapInvoiceSeller,
  selectInvoiceLines,
  toNumber,
  type DeliveryLineSource,
  type InvoiceLineSource,
} from '../order-invoice.service';

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

describe('mapDeliveryInvoiceLines', () => {
  const makeDeliveryLine = (
    overrides: Partial<DeliveryLineSource> = {},
  ): DeliveryLineSource => ({
    skuSnapshot: 'WEB-1',
    productNameSnapshot: 'Website product',
    quantity: 3,
    unitPrice: dec(250),
    lineTotal: dec(750),
    ...overrides,
  });

  it('maps website DeliveryLine snapshots', () => {
    expect(mapDeliveryInvoiceLines([makeDeliveryLine()])).toEqual([
      {
        sku: 'WEB-1',
        description: 'Website product',
        quantity: 3,
        unitPrice: 250,
        discountAmount: 0,
        lineTotal: 750,
      },
    ]);
  });

  it('uses an empty SKU when the snapshot has none', () => {
    expect(mapDeliveryInvoiceLines([makeDeliveryLine({ skuSnapshot: null })])[0]?.sku).toBe('');
  });
});

describe('selectInvoiceLines', () => {
  const saleLine = {
    sku: 'SALE-1',
    description: 'Sale line',
    quantity: 1,
    unitPrice: 500,
    discountAmount: 0,
    lineTotal: 500,
  };
  const deliveryLine = {
    sku: 'WEB-1',
    description: 'Website line',
    quantity: 2,
    unitPrice: 250,
    discountAmount: 0,
    lineTotal: 500,
  };

  it('prefers the POS sale lines when they exist', () => {
    expect(selectInvoiceLines([saleLine], [deliveryLine])).toEqual([saleLine]);
  });

  it('falls back to delivery lines when the linked sale has none', () => {
    expect(selectInvoiceLines([], [deliveryLine])).toEqual([deliveryLine]);
  });

  it('returns an empty list when neither source has lines', () => {
    expect(selectInvoiceLines([], [])).toEqual([]);
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

/** ARGUS #490: the invoice header must carry the seller contact, not just name/logo. */
describe('mapInvoiceSeller', () => {
  it('maps the store profile address, phone and email', () => {
    expect(
      mapInvoiceSeller({
        name: '  Ruhunu Weda Gedara ',
        settings: {
          address: ' 12 Galle Road\nMatara ',
          phoneNumber: ' 041 222 3344 ',
          email: ' hello@ruhunu.lk ',
          apiKey: 'never-print',
        },
      }),
    ).toEqual({
      name: 'Ruhunu Weda Gedara',
      address: '12 Galle Road\nMatara',
      phone: '041 222 3344',
      email: 'hello@ruhunu.lk',
    });
  });

  it('omits unset optional contact fields safely', () => {
    expect(mapInvoiceSeller({ name: 'Store', settings: null })).toEqual({
      name: 'Store',
      address: '',
      phone: '',
      email: '',
    });
  });
});
