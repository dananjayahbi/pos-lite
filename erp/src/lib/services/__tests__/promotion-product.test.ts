import { describe, it, expect } from 'vitest';

import { evaluateProductDiscounts, type CartLine } from '@/lib/services/promotion.service';

type PromoRows = Parameters<typeof evaluateProductDiscounts>[1];

function promo(overrides: Record<string, unknown> = {}) {
  return {
    id: 'promo-product',
    name: 'Product Sale',
    type: 'PRODUCT_PERCENTAGE',
    value: { toString: () => '10' },
    promoCode: null,
    targetCategoryId: null,
    targetProductId: 'product-1',
    minQuantity: null,
    startsAt: null,
    endsAt: null,
    isActive: true,
    description: null,
    ...overrides,
  } as unknown as PromoRows[number];
}

describe('evaluateProductDiscounts', () => {
  const cartLines: CartLine[] = [
    { variantId: 'variant-1', quantity: 2, unitPrice: '100.00' },
    { variantId: 'variant-2', quantity: 1, unitPrice: '50.00' },
  ];

  it('applies the percentage only to variants of the targeted product', () => {
    const productByVariantId = new Map([
      ['variant-1', 'product-1'],
      ['variant-2', 'product-2'],
    ]);
    const alreadyDiscounted = new Set<string>();

    const result = evaluateProductDiscounts(
      cartLines,
      [promo()],
      alreadyDiscounted,
      productByVariantId,
    );

    expect(result.applied).toHaveLength(1);
    expect(result.applied[0]).toMatchObject({
      promotionId: 'promo-product',
      promotionType: 'PRODUCT_PERCENTAGE',
      discountAmount: '20',
      affectedLines: ['variant-1'],
    });
    expect(alreadyDiscounted.has('variant-1')).toBe(true);
    expect(alreadyDiscounted.has('variant-2')).toBe(false);
  });

  it('skips a matching product whose line already has a discount', () => {
    const productByVariantId = new Map([['variant-1', 'product-1']]);
    const result = evaluateProductDiscounts(
      cartLines,
      [promo()],
      new Set(['variant-1']),
      productByVariantId,
    );

    expect(result.applied).toHaveLength(0);
    expect(result.skipped[0]?.reason).toBe('No matching items in cart');
  });

  it('skips a product promotion without a target product', () => {
    const result = evaluateProductDiscounts(
      cartLines,
      [promo({ targetProductId: null })],
      new Set(),
      new Map(),
    );

    expect(result.applied).toHaveLength(0);
    expect(result.skipped[0]?.reason).toBe('No target product set');
  });
});
