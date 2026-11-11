import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';

import { getSaleDiscountAmount } from '@/stores/cartStore';

/**
 * ISSUE 7 — the sales API has a single `discountAmount` channel while the POS
 * displays a manual cart discount and promotions separately. Both must end up
 * in the payload, otherwise the persisted total is higher than the amount due
 * (and a promotion-zeroed cart is rejected as a non-zero NONE tender).
 */
describe('getSaleDiscountAmount', () => {
  it('adds the promotion discount to the manual cart discount', () => {
    // 1,065 subtotal, 90% manual cart discount, 10% promotion.
    expect(getSaleDiscountAmount(1065, 958.5, 106.5).toNumber()).toBe(1065);
  });

  it('returns the manual discount when no promotion applies', () => {
    expect(getSaleDiscountAmount(1000, 50, 0).toNumber()).toBe(50);
  });

  it('returns the promotion discount when there is no manual discount', () => {
    expect(getSaleDiscountAmount('1000', '0', '100').toNumber()).toBe(100);
  });

  it('never exceeds the subtotal', () => {
    expect(getSaleDiscountAmount(1000, 900, 500).toNumber()).toBe(1000);
  });

  it('accepts Decimal inputs and keeps two-decimal precision', () => {
    const result = getSaleDiscountAmount(
      new Decimal('99.99'),
      new Decimal('10.005'),
      new Decimal('0.005'),
    );
    expect(result.toNumber()).toBe(10.01);
  });

  it('handles a zero subtotal', () => {
    expect(getSaleDiscountAmount(0, 0, 0).toNumber()).toBe(0);
  });
});
