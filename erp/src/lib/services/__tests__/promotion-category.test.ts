import { describe, expect, it } from 'vitest';

import {
  applyResolvedCategories,
  evaluateCategoryDiscounts,
  type CartLine,
} from '@/lib/services/promotion.service';

/**
 * ARGUS #323 — category promotions must use the variant's real category, never
 * a categoryId supplied by the cart client.
 */
function promo(overrides: Record<string, unknown> = {}) {
  return {
    id: 'promo-category',
    name: 'Category Discount',
    type: 'CATEGORY_PERCENTAGE',
    value: { toString: () => '15' },
    promoCode: null,
    targetCategoryId: 'category-real',
    targetProductId: null,
    minQuantity: null,
    startsAt: null,
    endsAt: null,
    isActive: true,
    description: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  } as unknown as Parameters<typeof evaluateCategoryDiscounts>[1][number];
}

describe('applyResolvedCategories', () => {
  it('replaces a spoofed category with the server-resolved one', () => {
    const lines: CartLine[] = [
      { variantId: 'ashwagandha', quantity: 1, unitPrice: '500.00', categoryId: 'category-oils' },
    ];

    const resolved = applyResolvedCategories(
      lines,
      new Map([['ashwagandha', 'category-powders']]),
    );

    expect(resolved[0]!.categoryId).toBe('category-powders');
  });

  it('clears a category when the variant is unknown or foreign', () => {
    const lines: CartLine[] = [
      { variantId: 'unknown', quantity: 1, unitPrice: '500.00', categoryId: 'category-oils' },
    ];

    expect(applyResolvedCategories(lines, new Map())[0]!.categoryId).toBeUndefined();
  });
});

describe('evaluateCategoryDiscounts with resolved categories', () => {
  it('does not let a spoofed category claim the category promotion', () => {
    const spoofed: CartLine[] = [
      { variantId: 'ashwagandha', quantity: 1, unitPrice: '500.00', categoryId: 'category-oils' },
    ];
    const resolved = applyResolvedCategories(
      spoofed,
      new Map([['ashwagandha', 'category-powders']]),
    );

    const result = evaluateCategoryDiscounts(resolved, [promo()], new Set());

    expect(result.applied).toHaveLength(0);
    expect(result.skipped[0]?.reason).toContain('No matching items');
  });

  it('applies to a genuine category match', () => {
    const resolved = applyResolvedCategories(
      [{ variantId: 'oil', quantity: 1, unitPrice: '500.00', categoryId: 'spoofed' }],
      new Map([['oil', 'category-real']]),
    );

    const result = evaluateCategoryDiscounts(resolved, [promo()], new Set());

    expect(result.applied).toHaveLength(1);
    expect(result.applied[0]?.discountAmount).toBe('75');
    expect(result.applied[0]?.affectedLines).toEqual(['oil']);
  });
});
