import { describe, expect, it } from 'vitest';

import { summarizePromotionUsage } from '@/lib/services/promotionUsage.core';

/** ARGUS #331: usage is derived from the sale ledger, never a schema counter. */
describe('summarizePromotionUsage', () => {
  it('returns zeroed maps when no sale carries promotion records', () => {
    const summary = summarizePromotionUsage([
      { appliedPromotions: null },
      { appliedPromotions: [] },
    ]);

    expect(summary.countByPromotionId).toEqual({});
    expect(summary.salesWithPromotions).toBe(0);
  });

  it('counts one redemption per sale that applied a promotion', () => {
    const summary = summarizePromotionUsage([
      {
        appliedPromotions: [
          { promotionId: 'promo-a', discountAmount: '10.00' },
          { promotionId: 'promo-b', discountAmount: '2.50' },
        ],
      },
      {
        appliedPromotions: [
          { promotionId: 'promo-a', discountAmount: '5.00' },
        ],
      },
    ]);

    expect(summary.countByPromotionId).toEqual({ 'promo-a': 2, 'promo-b': 1 });
    expect(summary.discountByPromotionId).toEqual({ 'promo-a': '15.00', 'promo-b': '2.50' });
    expect(summary.salesWithPromotions).toBe(2);
  });

  it('ignores malformed entries and synthetic records without an id', () => {
    const summary = summarizePromotionUsage([
      {
        appliedPromotions: [
          null,
          'not-an-object',
          { promotionId: '' },
          { discountAmount: '9.00' },
          { promotionId: 'promo-a', discountAmount: 'not-money' },
        ],
      },
    ]);

    expect(summary.countByPromotionId).toEqual({ 'promo-a': 1 });
    expect(summary.discountByPromotionId).toEqual({});
  });

  it('ignores a non-array appliedPromotions payload', () => {
    const summary = summarizePromotionUsage([{ appliedPromotions: { promotionId: 'promo-a' } }]);
    expect(summary.countByPromotionId).toEqual({});
    expect(summary.salesWithPromotions).toBe(0);
  });
});
