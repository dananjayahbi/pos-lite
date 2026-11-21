import { describe, expect, it } from 'vitest';

import {
  applyFixedToRemaining,
  applyPercentageToRemaining,
  remainingAfterDiscounts,
} from '@/lib/services/promotionStacking.core';

/**
 * ARGUS #322: percentages must apply sequentially to the remaining amount, and
 * the combined discount must never exceed the cart.
 */
describe('promotion stacking', () => {
  it('applies the reported 15% + 10% + 10% sequentially, not additively', () => {
    const subtotal = 4197.6;

    const category = applyPercentageToRemaining(subtotal, 15); // 629.64
    const afterCategory = remainingAfterDiscounts(subtotal, [category]);
    const cart = applyPercentageToRemaining(afterCategory, 10); // 356.80
    const afterCart = remainingAfterDiscounts(afterCategory, [cart]);
    const code = applyPercentageToRemaining(afterCart, 10); // 321.12

    expect(category).toBe(629.64);
    expect(cart).toBe(356.8);
    expect(code).toBe(321.12);

    const total = category + cart + code;
    expect(Math.round(total * 100) / 100).toBe(1307.56);
    // Additive would have been 1,469.16 (35%).
    expect(total).toBeLessThan(4197.6 * 0.35);
  });

  it('gives 10% cart + 10% code = 19% of the cart, not 20%', () => {
    const subtotal = 4197.6;
    const cart = applyPercentageToRemaining(subtotal, 10);
    const remaining = remainingAfterDiscounts(subtotal, [cart]);
    const code = applyPercentageToRemaining(remaining, 10);

    expect(Math.round((cart + code) * 100) / 100).toBe(797.54);
  });

  it('caps a percentage and a fixed amount at the remaining base', () => {
    expect(applyPercentageToRemaining(100, 150)).toBe(100);
    expect(applyFixedToRemaining(100, 500)).toBe(100);
    expect(applyPercentageToRemaining(0, 10)).toBe(0);
  });

  it('never lets discounts drive the remaining amount negative', () => {
    expect(remainingAfterDiscounts(100, [60, 60])).toBe(0);
    expect(remainingAfterDiscounts(100, [])).toBe(100);
  });
});
