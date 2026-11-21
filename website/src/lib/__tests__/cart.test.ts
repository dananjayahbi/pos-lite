import { describe, expect, it } from 'vitest';

import { computeCartTotals, parseParcelWeightKg } from '@/lib/cart';
import type { CartLine } from '@/stores/cartStore';

function line(overrides: Partial<CartLine> = {}): CartLine {
  return {
    variantId: 'v1',
    productId: 'p1',
    productName: 'Product',
    variantSku: 'SKU-1',
    price: 500,
    image: '',
    maxStock: 10,
    quantity: 2,
    addedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('computeCartTotals', () => {
  it('sums quantities and line totals', () => {
    const totals = computeCartTotals([line(), line({ variantId: 'v2', price: 250, quantity: 1 })]);
    expect(totals.itemCount).toBe(3);
    expect(totals.subtotal).toBe(1250);
    expect(totals.allInStock).toBe(true);
  });

  it('flags a cart whose line exceeds available stock', () => {
    expect(computeCartTotals([line({ quantity: 11, maxStock: 10 })]).allInStock).toBe(false);
  });
});

/** ARGUS #287 — the weight is collected at checkout and sent with the quote. */
describe('parseParcelWeightKg', () => {
  it('accepts a positive numeric string', () => {
    expect(parseParcelWeightKg('3.2')).toBe(3.2);
    expect(parseParcelWeightKg('1')).toBe(1);
    expect(parseParcelWeightKg(2.5)).toBe(2.5);
  });

  it('returns undefined for blank or missing input', () => {
    expect(parseParcelWeightKg('')).toBeUndefined();
    expect(parseParcelWeightKg('   ')).toBeUndefined();
    expect(parseParcelWeightKg(null)).toBeUndefined();
    expect(parseParcelWeightKg(undefined)).toBeUndefined();
  });

  it('rejects zero and negative weights', () => {
    expect(parseParcelWeightKg('0')).toBeUndefined();
    expect(parseParcelWeightKg('-2')).toBeUndefined();
  });

  it('rejects non-numeric input and rounds to the rate card precision', () => {
    expect(parseParcelWeightKg('abc')).toBeUndefined();
    expect(parseParcelWeightKg('1.2345')).toBe(1.23);
  });
});
