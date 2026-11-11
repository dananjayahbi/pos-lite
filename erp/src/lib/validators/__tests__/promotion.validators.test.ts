import { describe, it, expect } from 'vitest';

import { CreatePromotionSchema } from '@/lib/validators/promotion.validators';

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
