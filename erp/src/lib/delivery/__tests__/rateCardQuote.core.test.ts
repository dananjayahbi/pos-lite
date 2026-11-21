import { describe, expect, it } from 'vitest';

import {
  MAX_RATE_AMOUNT,
  MAX_RATE_WEIGHT_KG,
  quoteRateCard,
} from '@/lib/delivery/rateCardQuote.core';

const terms = { baseRate: 475, extraKgRate: 100, freeBaseWeightKg: 1 };

describe('quoteRateCard (ARGUS #296)', () => {
  it('uses the same base + extra-kg arithmetic as the engine', () => {
    expect(quoteRateCard({ ...terms, weightKg: 1 }).shippingFee).toBe(475);
    expect(quoteRateCard({ ...terms, weightKg: 2.1 })).toEqual({
      ok: true,
      shippingFee: 675,
      extraKg: 2,
    });
  });

  it('rejects zero/absurd weights with a clear message', () => {
    expect(quoteRateCard({ ...terms, weightKg: 0 }).ok).toBe(false);
    expect(quoteRateCard({ ...terms, weightKg: MAX_RATE_WEIGHT_KG + 1 })).toEqual({
      ok: false,
      error: `Weight cannot exceed ${MAX_RATE_WEIGHT_KG} kg.`,
    });
  });

  it('rejects a rate above the sane limit', () => {
    expect(quoteRateCard({ ...terms, weightKg: 1, baseRate: MAX_RATE_AMOUNT + 1 }).ok).toBe(
      false,
    );
    expect(quoteRateCard({ ...terms, weightKg: 1, baseRate: -1 }).ok).toBe(false);
  });
});
