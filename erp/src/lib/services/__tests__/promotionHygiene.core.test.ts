import { describe, expect, it } from 'vitest';

import { auditPromotions } from '@/lib/services/promotionHygiene.core';

/** ARGUS #68: surface open-ended and untargeted promotions. */
const base = {
  id: 'p',
  name: 'Promo',
  type: 'CART_PERCENTAGE',
  isActive: true,
  startsAt: null,
  endsAt: null,
  targetCategoryId: null,
  targetProductId: null,
};

describe('auditPromotions', () => {
  it('flags active promotions with no date window', () => {
    const result = auditPromotions([base], new Date('2026-11-20T00:00:00Z'));
    expect(result.openEnded.map((row) => row.id)).toEqual(['p']);
    expect(result.missingTarget).toEqual([]);
  });

  it('does not flag a promotion with a start or end date', () => {
    const result = auditPromotions([
      { ...base, startsAt: '2026-11-01' },
      { ...base, id: 'q', endsAt: '2026-12-31' },
    ]);
    expect(result.openEnded).toEqual([]);
  });

  it('ignores inactive promotions', () => {
    const result = auditPromotions([{ ...base, isActive: false }]);
    expect(result.openEnded).toEqual([]);
  });

  it('flags BOGO/Mix without any target', () => {
    const result = auditPromotions([
      { ...base, id: 'bogo', type: 'BOGO' },
      { ...base, id: 'mix', type: 'MIX_AND_MATCH' },
    ]);
    expect(result.missingTarget.map((row) => row.id)).toEqual(['bogo', 'mix']);
  });

  it('accepts a target as a valid BOGO configuration', () => {
    const result = auditPromotions([
      { ...base, id: 'bogo', type: 'BOGO', targetProductId: 'product-1' },
    ]);
    expect(result.missingTarget).toEqual([]);
  });

  it('flags promotions ending within seven days', () => {
    const now = new Date('2026-11-20T00:00:00Z');
    const result = auditPromotions(
      [
        { ...base, id: 'soon', endsAt: '2026-11-23T00:00:00Z' },
        { ...base, id: 'later', endsAt: '2026-12-30T00:00:00Z' },
      ],
      now,
    );
    expect(result.expiringSoon.map((row) => row.id)).toEqual(['soon']);
  });
});
