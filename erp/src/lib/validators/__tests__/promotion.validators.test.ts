import { describe, it, expect } from 'vitest';

import { CreatePromotionSchema, EvaluateCartSchema, UpdatePromotionSchema } from '@/lib/validators/promotion.validators';

describe('CreatePromotionSchema free-item promotions (ARGUS #324)', () => {
  it('accepts a BOGO with a cap, buy quantity and target', () => {
    const parsed = CreatePromotionSchema.safeParse({
      name: 'Buy 2 get 1',
      type: 'BOGO',
      value: 2500,
      minQuantity: 2,
      targetProductId: 'product-1',
    });

    expect(parsed.success).toBe(true);
  });

  it('requires a target for BOGO/Mix', () => {
    for (const type of ['BOGO', 'MIX_AND_MATCH']) {
      const parsed = CreatePromotionSchema.safeParse({
        name: 'No target',
        type,
        value: 2500,
        minQuantity: 2,
      });

      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.path).toEqual(['targetProductId']);
      }
    }
  });

  it('treats the value as a money cap, not an integer free-item count', () => {
    const parsed = CreatePromotionSchema.safeParse({
      name: 'Capped free item',
      type: 'MIX_AND_MATCH',
      value: 2500.5,
      minQuantity: 3,
      targetCategoryId: 'category-1',
    });

    expect(parsed.success).toBe(true);
  });

  it('keeps the cap inside the money column with at most 2 decimals', () => {
    const tooLarge = CreatePromotionSchema.safeParse({
      name: 'Huge cap',
      type: 'BOGO',
      value: 10_000_000_000,
      targetProductId: 'product-1',
    });
    expect(tooLarge.success).toBe(false);

    const tooPrecise = CreatePromotionSchema.safeParse({
      name: 'Precise cap',
      type: 'BOGO',
      value: 10.999,
      targetProductId: 'product-1',
    });
    expect(tooPrecise.success).toBe(false);
  });
});

describe('CreatePromotionSchema product promotions', () => {
  it('accepts a product percentage promotion with a target product', () => {
    const parsed = CreatePromotionSchema.safeParse({
      name: 'Ashwagandha Sale',
      type: 'PRODUCT_PERCENTAGE',
      value: 15,
      targetProductId: 'product-1',
    });

    expect(parsed.success).toBe(true);
  });

  it('accepts a product fixed promotion with a target product', () => {
    const parsed = CreatePromotionSchema.safeParse({
      name: 'Rs. 100 off',
      type: 'PRODUCT_FIXED',
      value: 100,
      targetProductId: 'product-1',
    });

    expect(parsed.success).toBe(true);
  });

  it('keeps product fixed promotions inside the money column', () => {
    const parsed = CreatePromotionSchema.safeParse({
      name: 'Too much',
      type: 'PRODUCT_FIXED',
      value: 10_000_000_000,
      targetProductId: 'product-1',
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.path).toEqual(['value']);
    }
  });

  it('bounds product percentage promotions at 100%', () => {
    const parsed = CreatePromotionSchema.safeParse({
      name: 'Impossible Sale',
      type: 'PRODUCT_PERCENTAGE',
      value: 101,
      targetProductId: 'product-1',
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.path).toEqual(['value']);
    }
  });
});

describe('CreatePromotionSchema windows (ARGUS #327)', () => {
  it('accepts a same-day date-only window', () => {
    const parsed = CreatePromotionSchema.safeParse({
      name: 'One day sale',
      type: 'CART_PERCENTAGE',
      value: 10,
      startsAt: '2026-10-29',
      endsAt: '2026-10-29',
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects an end date before the start date', () => {
    const parsed = CreatePromotionSchema.safeParse({
      name: 'Backwards',
      type: 'CART_PERCENTAGE',
      value: 10,
      startsAt: '2026-10-29',
      endsAt: '2026-10-28',
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.path).toEqual(['endsAt']);
      expect(parsed.error.issues[0]?.message).toMatch(/after the start/i);
    }
  });

  it('rejects a malformed start date as a typed validation issue', () => {
    const parsed = CreatePromotionSchema.safeParse({
      name: 'Bad date',
      type: 'CART_PERCENTAGE',
      value: 10,
      startsAt: 'not-a-date',
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.path).toEqual(['startsAt']);
    }
  });

  it('normalizes blank create bounds to undefined (open bound)', () => {
    const parsed = CreatePromotionSchema.safeParse({
      name: 'Open',
      type: 'CART_PERCENTAGE',
      value: 10,
      startsAt: '',
      endsAt: '',
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.startsAt).toBeUndefined();
      expect(parsed.data.endsAt).toBeUndefined();
    }
  });

  it('lets PATCH clear a bound with null / empty and validates only supplied bounds', () => {
    const cleared = UpdatePromotionSchema.safeParse({ startsAt: null, endsAt: '' });
    expect(cleared.success).toBe(true);
    if (cleared.success) {
      expect(cleared.data.startsAt).toBeNull();
      expect(cleared.data.endsAt).toBeNull();
    }

    const backwards = UpdatePromotionSchema.safeParse({
      startsAt: '2026-10-29',
      endsAt: '2026-10-28',
    });
    expect(backwards.success).toBe(false);
  });
});

describe('CreatePromotionSchema conditional requirements (ARGUS #330)', () => {
  it('requires a code for PROMO_CODE', () => {
    const parsed = CreatePromotionSchema.safeParse({
      name: 'No code',
      type: 'PROMO_CODE',
      value: 10,
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.path).toEqual(['promoCode']);
    }
  });

  it('accepts PROMO_CODE with a code', () => {
    expect(
      CreatePromotionSchema.safeParse({
        name: 'Summer',
        type: 'PROMO_CODE',
        value: 10,
        promoCode: 'SUMMER10',
      }).success,
    ).toBe(true);
  });

  it('stores a promo code in the uppercase the input shows (ARGUS #334)', () => {
    const parsed = CreatePromotionSchema.safeParse({
      name: 'Summer',
      type: 'PROMO_CODE',
      value: 10,
      promoCode: ' summer10 ',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.promoCode).toBe('SUMMER10');
  });

  it('requires a category for CATEGORY_PERCENTAGE', () => {
    const parsed = CreatePromotionSchema.safeParse({
      name: 'No category',
      type: 'CATEGORY_PERCENTAGE',
      value: 10,
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.path).toEqual(['targetCategoryId']);
    }
  });

  it('requires a product for PRODUCT_PERCENTAGE and PRODUCT_FIXED', () => {
    for (const type of ['PRODUCT_PERCENTAGE', 'PRODUCT_FIXED']) {
      const parsed = CreatePromotionSchema.safeParse({
        name: 'No product',
        type,
        value: 10,
      });

      expect(parsed.success, type).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.path).toEqual(['targetProductId']);
      }
    }
  });
});

/** ARGUS #334: the evaluate endpoint must return 400, not 500/negative money. */
describe('EvaluateCartSchema input hardening', () => {
  const line = {
    variantId: 'variant-1',
    quantity: 2,
    unitPrice: '1000.00',
  };

  it('accepts a normal cart line', () => {
    expect(EvaluateCartSchema.safeParse({ cartLines: [line] }).success).toBe(true);
  });

  it('rejects a non-numeric unit price with a field error', () => {
    const parsed = EvaluateCartSchema.safeParse({
      cartLines: [{ ...line, unitPrice: 'not-a-price' }],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.path).toEqual(['cartLines', 0, 'unitPrice']);
    }
  });

  it('rejects negative unit price and manual discount values', () => {
    expect(
      EvaluateCartSchema.safeParse({ cartLines: [{ ...line, unitPrice: '-1' }] }).success,
    ).toBe(false);
    expect(
      EvaluateCartSchema.safeParse({
        cartLines: [{ ...line, manualDiscountAmount: '-15' }],
      }).success,
    ).toBe(false);
  });

  it('bounds the manual discount at the line total', () => {
    expect(
      EvaluateCartSchema.safeParse({
        cartLines: [{ ...line, manualDiscountAmount: '2000' }],
      }).success,
    ).toBe(true);
    expect(
      EvaluateCartSchema.safeParse({
        cartLines: [{ ...line, manualDiscountAmount: '2000.01' }],
      }).success,
    ).toBe(false);
  });

  it('bounds quantity and money to storage-safe ceilings', () => {
    expect(
      EvaluateCartSchema.safeParse({ cartLines: [{ ...line, quantity: 0 }] }).success,
    ).toBe(false);
    expect(
      EvaluateCartSchema.safeParse({
        cartLines: [{ ...line, unitPrice: '10000000000.00' }],
      }).success,
    ).toBe(false);
  });
});
