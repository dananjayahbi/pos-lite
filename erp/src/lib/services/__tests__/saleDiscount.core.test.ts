import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';

import { allocateCartDiscountShares } from '@/lib/services/saleDiscount.core';

const d = (value: string | number) => new Decimal(value);

/**
 * ISSUE 7 — the cart discount must be apportioned across lines before tax is
 * computed, otherwise a fully discounted VAT sale still owes tax and can never
 * reach a genuine Rs. 0.00 total.
 */
describe('allocateCartDiscountShares', () => {
  it('gives the whole discount to a single line', () => {
    const [share] = allocateCartDiscountShares([d('1065')], d('1065'));
    expect(share!.toNumber()).toBe(1065);
  });

  it('splits proportionally across lines', () => {
    const shares = allocateCartDiscountShares([d('600'), d('400')], d('100'));
    expect(shares.map((s) => s.toNumber())).toEqual([60, 40]);
  });

  it('makes the last line absorb rounding so the shares sum exactly', () => {
    const shares = allocateCartDiscountShares([d('1'), d('1'), d('1')], d('1'));
    expect(shares.map((s) => s.toNumber())).toEqual([0.33, 0.33, 0.34]);
    expect(Decimal.sum(...shares).toNumber()).toBe(1);
  });

  it('returns zeros when there is no discount', () => {
    const shares = allocateCartDiscountShares([d('100'), d('50')], d('0'));
    expect(shares.map((s) => s.toNumber())).toEqual([0, 0]);
  });

  it('returns zeros for an empty cart', () => {
    expect(allocateCartDiscountShares([], d('10'))).toEqual([]);
  });

  it('never allocates more than a line total', () => {
    const shares = allocateCartDiscountShares([d('100'), d('100')], d('200'));
    expect(shares.map((s) => s.toNumber())).toEqual([100, 100]);
  });

  it('handles a zero subtotal safely', () => {
    const shares = allocateCartDiscountShares([d('0'), d('0')], d('10'));
    expect(shares.map((s) => s.toNumber())).toEqual([0, 0]);
  });

  it('leaves a taxable remainder when the discount is partial', () => {
    // 18% VAT + 2.5% SSCL on a 1,065 line with a 50% cart discount.
    const shares = allocateCartDiscountShares([d('1065')], d('532.50'));
    const taxable = d('1065').minus(shares[0]!);
    expect(taxable.toNumber()).toBe(532.5);
    expect(taxable.mul(d('0.205')).toDecimalPlaces(2).toNumber()).toBe(109.16);
  });
});
