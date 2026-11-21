import { describe, it, expect } from 'vitest';

import { CreatePromotionSchema } from '@/lib/validators/promotion.validators';

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
