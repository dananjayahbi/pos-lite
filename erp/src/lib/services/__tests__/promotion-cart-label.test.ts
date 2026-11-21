import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';

import { cartPromotionLabel, evaluateCartPromotions } from '@/lib/services/promotion.service';

function promo(overrides: Record<string, unknown> = {}) {
  return {
    id: 'promo-10',
    name: '10% Off Everything',
    type: 'CART_PERCENTAGE',
    value: { toString: () => '10' },
    promoCode: null,
    targetCategoryId: null,
    targetProductId: null,
    minQuantity: 1,
    startsAt: null,
    endsAt: null,
    isActive: true,
    description: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  } as unknown as Parameters<typeof evaluateCartPromotions>[2][number];
}

describe('cart promotion label (ARGUS #71)', () => {
  it('uses the promotion name once instead of repeating the discount', () => {
    expect(cartPromotionLabel('10% Off Everything')).toBe('10% Off Everything');
    expect(cartPromotionLabel('  10% Off Everything  ')).toBe('10% Off Everything');
    expect(cartPromotionLabel('')).toBe('Cart promotion');
    expect(cartPromotionLabel('   ')).toBe('Cart promotion');
  });

  it('applies a cart percentage promotion with a single clear label', () => {
    const { applied } = evaluateCartPromotions(
      [{ variantId: 'v1', quantity: 2, unitPrice: '1000.00' }],
      new Decimal('2000'),
      [promo()],
    );

    expect(applied).toHaveLength(1);
    expect(applied[0]?.label).toBe('10% Off Everything');
    expect(applied[0]?.discountAmount).toBe('200');
    expect(applied[0]?.label).not.toMatch(/off cart/i);
  });
});
