import { describe, expect, it } from 'vitest';

import { summarizeCartDiscounts } from '@/components/pos/cartDiscountSummary';

/**
 * ARGUS #67 — the collapsed header must never claim "no discount" while any
 * line/cart/promotion discount is active.
 */
function item(unitPrice: number, quantity = 1, discountPercent = 0) {
  return { unitPrice, quantity, discountPercent };
}

describe('summarizeCartDiscounts', () => {
  it('reports no discount when nothing is active', () => {
    const summary = summarizeCartDiscounts({
      items: [item(100)],
      subtotal: 100,
      manualDiscount: 0,
      promotionDiscount: 0,
    });

    expect(summary.hasAny).toBe(false);
    expect(summary.totalDiscount).toBe('0.00');
    expect(summary.label).toBe('No discount or promo');
  });

  it('summarises a manual cart discount only', () => {
    const summary = summarizeCartDiscounts({
      items: [item(100)],
      subtotal: 100,
      manualDiscount: 10,
      promotionDiscount: 0,
      cartDiscountPercent: 10,
    });

    expect(summary.totalDiscount).toBe('10.00');
    expect(summary.parts).toEqual(['cart 10%']);
    expect(summary.label).toContain('Rs. 10.00');
  });

  it('summarises a promotion only', () => {
    const summary = summarizeCartDiscounts({
      items: [item(100)],
      subtotal: 100,
      manualDiscount: 0,
      promotionDiscount: 10,
      promoCode: 'SAVE10',
    });

    expect(summary.totalDiscount).toBe('10.00');
    expect(summary.parts).toEqual(['promo SAVE10']);
  });

  it('summarises a line discount only', () => {
    const summary = summarizeCartDiscounts({
      items: [item(100, 2, 5)],
      subtotal: 190,
      manualDiscount: 0,
      promotionDiscount: 0,
    });

    expect(summary.lineDiscount).toBe('10.00');
    expect(summary.totalDiscount).toBe('10.00');
    expect(summary.parts).toEqual(['line 5%']);
  });

  it('combines line + manual + promotion', () => {
    const summary = summarizeCartDiscounts({
      items: [item(100, 2, 5)],
      subtotal: 190,
      manualDiscount: 9.5,
      promotionDiscount: 0,
    });

    expect(summary.totalDiscount).toBe('19.50');
    expect(summary.parts).toEqual(['line 5%', 'cart discount']);
    expect(summary.tooltip).toContain('Total discount: Rs. 19.50');
  });

  it('caps the total at the gross value when discounts zero the cart', () => {
    const summary = summarizeCartDiscounts({
      items: [item(100, 1, 5)],
      subtotal: 95,
      manualDiscount: 95,
      promotionDiscount: 9.5,
      cartDiscountPercent: 100,
    });

    // Line 5 + cart 95 + (promotion fully clamped to 0) = 100 gross.
    expect(summary.totalDiscount).toBe('100.00');
    expect(summary.hasAny).toBe(true);
  });
});
