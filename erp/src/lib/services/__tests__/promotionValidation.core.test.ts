import { describe, expect, it } from 'vitest';

import {
  normalizePromoCode,
  promoCodeConflicts,
  promoCodeKey,
  promotionTypeIssues,
} from '@/lib/services/promotionValidation.core';

/** ARGUS #330: active promotions that can never apply must be rejected. */
describe('promotionTypeIssues', () => {
  it('requires a code for PROMO_CODE', () => {
    const issues = promotionTypeIssues({ type: 'PROMO_CODE', promoCode: '   ' });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toBe('promoCode');
  });

  it('accepts PROMO_CODE with a code', () => {
    expect(promotionTypeIssues({ type: 'PROMO_CODE', promoCode: 'SUMMER10' })).toEqual([]);
  });

  it('requires a category for CATEGORY_PERCENTAGE', () => {
    expect(promotionTypeIssues({ type: 'CATEGORY_PERCENTAGE' })[0]?.path).toBe('targetCategoryId');
    expect(
      promotionTypeIssues({ type: 'CATEGORY_PERCENTAGE', targetCategoryId: 'cat-1' }),
    ).toEqual([]);
  });

  it('requires a product for PRODUCT_PERCENTAGE and PRODUCT_FIXED', () => {
    for (const type of ['PRODUCT_PERCENTAGE', 'PRODUCT_FIXED']) {
      expect(promotionTypeIssues({ type })[0]?.path).toBe('targetProductId');
      expect(promotionTypeIssues({ type, targetProductId: 'prod-1' })).toEqual([]);
    }
  });

  it('requires a product or category for BOGO / MIX_AND_MATCH', () => {
    for (const type of ['BOGO', 'MIX_AND_MATCH']) {
      expect(promotionTypeIssues({ type })[0]?.path).toBe('targetProductId');
      expect(promotionTypeIssues({ type, targetCategoryId: 'cat-1' })).toEqual([]);
      expect(promotionTypeIssues({ type, targetProductId: 'prod-1' })).toEqual([]);
    }
  });

  it('does not require targets for cart-level promotions', () => {
    expect(promotionTypeIssues({ type: 'CART_PERCENTAGE' })).toEqual([]);
    expect(promotionTypeIssues({ type: 'CART_FIXED' })).toEqual([]);
  });
});

describe('promo code identity', () => {
  it('trims and treats blank as no code', () => {
    expect(normalizePromoCode('  summer10 ')).toBe('summer10');
    expect(normalizePromoCode('   ')).toBeNull();
    expect(normalizePromoCode(null)).toBeNull();
  });

  it('compares case-insensitively', () => {
    expect(promoCodeKey('Summer10')).toBe('SUMMER10');
    expect(promoCodeConflicts('SUMMER10', 'summer10')).toBe(true);
    expect(promoCodeConflicts(' SUMMER10 ', 'Summer10')).toBe(true);
    expect(promoCodeConflicts('SUMMER10', 'WINTER10')).toBe(false);
    expect(promoCodeConflicts(null, 'SUMMER10')).toBe(false);
    expect(promoCodeConflicts('', '')).toBe(false);
  });
});
