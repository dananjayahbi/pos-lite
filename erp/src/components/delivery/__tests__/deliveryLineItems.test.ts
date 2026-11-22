import { describe, expect, it } from 'vitest';

import {
  deliveryLinesTotal,
  toDeliveryLineRows,
  toLineInputs,
} from '@/components/delivery/deliveryLineItems';

const lines = [
  {
    id: 'line-1',
    productNameSnapshot: 'Cotton Shirt',
    skuSnapshot: 'SKU-SHIRT',
    quantity: 2,
    unitPrice: '250.00',
    lineTotal: '500.00',
  },
  {
    id: 'line-2',
    productNameSnapshot: 'Gift Wrap',
    skuSnapshot: null,
    quantity: 1,
    unitPrice: '0.00',
    lineTotal: '0.00',
  },
];

/**
 * ARGUS #271 - a delivery with item count 2 and COD Rs. 500 must show the
 * product/SKU, quantity and line total, not only the count.
 */
describe('toDeliveryLineRows', () => {
  it('maps Decimal strings from the API to display rows', () => {
    expect(toDeliveryLineRows(lines)).toEqual([
      {
        id: 'line-1',
        productName: 'Cotton Shirt',
        sku: 'SKU-SHIRT',
        quantity: 2,
        unitPrice: 250,
        lineTotal: 500,
      },
      {
        id: 'line-2',
        productName: 'Gift Wrap',
        sku: '-',
        quantity: 1,
        unitPrice: 0,
        lineTotal: 0,
      },
    ]);
  });

  it('handles a missing or empty line list', () => {
    expect(toDeliveryLineRows(undefined)).toEqual([]);
    expect(toDeliveryLineRows([])).toEqual([]);
  });

  it('accepts Decimal-like values with toString', () => {
    const rows = toDeliveryLineRows([
      {
        productNameSnapshot: 'Mug',
        quantity: 1,
        unitPrice: { toString: () => '150.50' },
        lineTotal: { toString: () => '150.50' },
      },
    ]);
    expect(rows[0]?.unitPrice).toBe(150.5);
    expect(rows[0]?.lineTotal).toBe(150.5);
  });

  it('falls back to zero for malformed amounts', () => {
    const rows = toDeliveryLineRows([
      {
        productNameSnapshot: 'Mug',
        quantity: 1,
        unitPrice: 'not-a-number',
        lineTotal: '',
      },
    ]);
    expect(rows[0]?.unitPrice).toBe(0);
    expect(rows[0]?.lineTotal).toBe(0);
  });
});

describe('deliveryLinesTotal', () => {
  it('sums the recorded line totals', () => {
    expect(deliveryLinesTotal(lines)).toBe(500);
  });

  it('is zero for a delivery with no lines', () => {
    expect(deliveryLinesTotal(undefined)).toBe(0);
  });
});

describe('toLineInputs', () => {
  it('passes the API payload through and handles undefined', () => {
    expect(toLineInputs(undefined)).toEqual([]);
    expect(toLineInputs([{ variantId: 'v1', productNameSnapshot: 'Mug', quantity: 1, unitPrice: '10.00', lineTotal: '10.00' }])).toEqual([
      {
        id: undefined,
        productNameSnapshot: 'Mug',
        skuSnapshot: undefined,
        quantity: 1,
        unitPrice: '10.00',
        lineTotal: '10.00',
      },
    ]);
  });
});
