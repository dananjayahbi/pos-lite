import { describe, expect, it } from 'vitest';

import {
  assertDiscountsAuthorized,
  cartDiscountPercent,
  reconcileSaleDiscount,
  sumClientPromotionDiscount,
} from '@/lib/services/saleDiscountValidation.core';

/**
 * ARGUS #321: sale discounts/promotions were client-supplied and never
 * revalidated, and the cashier thresholds were enforced in the UI only.
 */
describe('sumClientPromotionDiscount', () => {
  it('adds discountAmount across promotion records', () => {
    expect(
      sumClientPromotionDiscount([
        { discountAmount: '100.50' },
        { discountAmount: 20 },
        { discountAmount: 'bad' },
        null,
      ]).toNumber(),
    ).toBe(120.5);
  });

  it('returns 0 for a missing/invalid payload', () => {
    expect(sumClientPromotionDiscount(undefined).toNumber()).toBe(0);
    expect(sumClientPromotionDiscount({}).toNumber()).toBe(0);
  });
});

describe('reconcileSaleDiscount', () => {
  it('splits the submitted discount into manual + verified promo', () => {
    const result = reconcileSaleDiscount({
      subtotal: 2000,
      submittedDiscount: 300,
      clientPromoTotal: 200,
      serverPromoTotal: 200,
    });

    expect(result.manualDiscount.toNumber()).toBe(100);
    expect(result.cartDiscount.toNumber()).toBe(300);
  });

  it('rejects a stale/forged promotion total', () => {
    expect(() =>
      reconcileSaleDiscount({
        subtotal: 2000,
        submittedDiscount: 900,
        clientPromoTotal: 900,
        serverPromoTotal: 100,
      }),
    ).toThrow(/PROMOTION_MISMATCH/);
  });

  it('rejects a cart discount smaller than its promotions', () => {
    expect(() =>
      reconcileSaleDiscount({
        subtotal: 2000,
        submittedDiscount: 50,
        clientPromoTotal: 100,
        serverPromoTotal: 100,
      }),
    ).toThrow(/INVALID_DISCOUNT/);
  });

  it('caps the discount at the subtotal', () => {
    const result = reconcileSaleDiscount({
      subtotal: 500,
      submittedDiscount: 900,
      clientPromoTotal: 0,
      serverPromoTotal: 0,
    });
    expect(result.cartDiscount.toNumber()).toBe(500);
  });
});

describe('assertDiscountsAuthorized', () => {
  it('allows a cashier within both thresholds', () => {
    expect(() =>
      assertDiscountsAuthorized({
        canOverride: false,
        lineDiscountPercents: [10],
        cartDiscountPercent: 5,
      }),
    ).not.toThrow();
  });

  it('rejects a line discount above the cashier limit', () => {
    expect(() =>
      assertDiscountsAuthorized({
        canOverride: false,
        lineDiscountPercents: [11],
        cartDiscountPercent: 0,
      }),
    ).toThrow(/DISCOUNT_REQUIRES_MANAGER/);
  });

  it('rejects a cart discount above the cashier limit', () => {
    expect(() =>
      assertDiscountsAuthorized({
        canOverride: false,
        lineDiscountPercents: [],
        cartDiscountPercent: '5.01',
      }),
    ).toThrow(/DISCOUNT_REQUIRES_MANAGER/);
  });

  it('lets a validated manager override both limits', () => {
    expect(() =>
      assertDiscountsAuthorized({
        canOverride: true,
        lineDiscountPercents: [100],
        cartDiscountPercent: 100,
      }),
    ).not.toThrow();
  });
});

describe('cartDiscountPercent', () => {
  it('computes the percentage of the subtotal', () => {
    expect(cartDiscountPercent(100, 2000).toNumber()).toBe(5);
  });

  it('returns 0 for an empty subtotal', () => {
    expect(cartDiscountPercent(0, 0).toNumber()).toBe(0);
  });
});
