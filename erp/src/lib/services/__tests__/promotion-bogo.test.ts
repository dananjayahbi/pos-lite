import { describe, expect, it } from 'vitest';

import { evaluateBOGO, type CartLine } from '@/lib/services/promotion.service';

/**
 * ARGUS #324 — buy-N-get-free is per line, capped per free unit, and only for
 * the promotion's target product/category.
 */
function promo(overrides: Record<string, unknown> = {}) {
  return {
    id: 'promo-bogo',
    name: 'QA BOGO',
    type: 'BOGO',
    value: { toString: () => '2500' },
    promoCode: null,
    targetCategoryId: null,
    targetProductId: 'product-1',
    minQuantity: 2,
    startsAt: null,
    endsAt: null,
    isActive: true,
    description: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  } as unknown as Parameters<typeof evaluateBOGO>[1][number];
}

const productByVariantId = new Map([
  ['v1', 'product-1'],
  ['v2', 'product-2'],
]);

describe('evaluateBOGO', () => {
  it('skips a promotion with no target instead of applying to everything', () => {
    const result = evaluateBOGO(
      [{ variantId: 'v1', quantity: 4, unitPrice: '500.00' }],
      [promo({ targetProductId: null, targetCategoryId: null })],
      new Set(),
      productByVariantId,
    );

    expect(result.applied).toHaveLength(0);
    expect(result.skipped[0]?.reason).toContain('No target product or category');
  });

  it('applies only to the targeted product line', () => {
    const lines: CartLine[] = [
      { variantId: 'v1', quantity: 4, unitPrice: '500.00' },
      { variantId: 'v2', quantity: 4, unitPrice: '900.00' },
    ];

    const result = evaluateBOGO(lines, [promo()], new Set(), productByVariantId);

    expect(result.applied).toHaveLength(1);
    expect(result.applied[0]?.discountAmount).toBe('1000');
    expect(result.applied[0]?.affectedLines).toEqual(['v1']);
  });

  it('caps each free unit at the configured item value', () => {
    const result = evaluateBOGO(
      [{ variantId: 'v1', quantity: 2, unitPrice: '5000.00' }],
      [promo({ minQuantity: 2, value: { toString: () => '2500' } })],
      new Set(),
      productByVariantId,
    );

    expect(result.applied[0]?.discountAmount).toBe('2500');
  });

  it('uses minQuantity as buy N per line', () => {
    const result = evaluateBOGO(
      [{ variantId: 'v1', quantity: 5, unitPrice: '500.00' }],
      [promo({ minQuantity: 3 })],
      new Set(),
      productByVariantId,
    );

    // floor(5 / 3) = 1 free unit.
    expect(result.applied[0]?.discountAmount).toBe('500');
  });

  it('matches a target category from the resolved cart line', () => {
    const result = evaluateBOGO(
      [{ variantId: 'v1', quantity: 2, unitPrice: '500.00', categoryId: 'category-real' }],
      [promo({ targetProductId: null, targetCategoryId: 'category-real' })],
      new Set(),
      productByVariantId,
    );

    expect(result.applied).toHaveLength(1);
    expect(result.applied[0]?.discountAmount).toBe('500');
  });

  it('skips lines already discounted and promotions with a zero cap', () => {
    const already = new Set(['v1']);
    const discounted = evaluateBOGO(
      [{ variantId: 'v1', quantity: 4, unitPrice: '500.00' }],
      [promo()],
      already,
      productByVariantId,
    );
    expect(discounted.applied).toHaveLength(0);

    const zeroCap = evaluateBOGO(
      [{ variantId: 'v1', quantity: 4, unitPrice: '500.00' }],
      [promo({ value: { toString: () => '0' } })],
      new Set(),
      productByVariantId,
    );
    expect(zeroCap.applied).toHaveLength(0);
    expect(zeroCap.skipped[0]?.reason).toContain('greater than zero');
  });
});
