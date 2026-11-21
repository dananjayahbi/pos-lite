import { describe, expect, it } from 'vitest';

import { computeShippingFeeFromTerms } from '@/lib/delivery/shipping-rate.core';

/**
 * ARGUS #287 — the live card is base Rs 475, free 0 kg, Rs 100 per extra kg.
 * A 1 kg parcel is 575 and a 3.2 kg parcel is 875. The website never sent a
 * weight, so every online quote stopped at the 475 base rate.
 */
const LIVE_CARD = { baseRate: 475, extraKgRate: 100, freeBaseWeightKg: 0 };

describe('computeShippingFeeFromTerms', () => {
  it('prices a 1 kg parcel at base + 1 kg', () => {
    expect(computeShippingFeeFromTerms(1, LIVE_CARD).shippingFee.toNumber()).toBe(575);
  });

  it('rounds 3.2 kg up to 4 chargeable kg', () => {
    const quote = computeShippingFeeFromTerms('3.2', LIVE_CARD);
    expect(quote.extraKg.toNumber()).toBe(4);
    expect(quote.shippingFee.toNumber()).toBe(875);
  });

  it('charges only the base rate at or below the free allowance', () => {
    const card = { baseRate: 475, extraKgRate: 100, freeBaseWeightKg: 1 };
    expect(computeShippingFeeFromTerms(0, card).shippingFee.toNumber()).toBe(475);
    expect(computeShippingFeeFromTerms(1, card).shippingFee.toNumber()).toBe(475);
    expect(computeShippingFeeFromTerms('0.8', card).shippingFee.toNumber()).toBe(475);
  });

  it('charges the first extra kg above a non-zero allowance', () => {
    const card = { baseRate: 475, extraKgRate: 100, freeBaseWeightKg: 1 };
    // 1.2 kg -> ceil(0.2) = 1 extra kg
    expect(computeShippingFeeFromTerms(1.2, card).shippingFee.toNumber()).toBe(575);
    // 2.0 kg -> exactly 1 extra kg
    expect(computeShippingFeeFromTerms(2, card).shippingFee.toNumber()).toBe(575);
    // 2.1 kg -> 2 extra kg
    expect(computeShippingFeeFromTerms(2.1, card).shippingFee.toNumber()).toBe(675);
  });

  it('falls back to the base rate when weight is unknown', () => {
    expect(computeShippingFeeFromTerms(null, LIVE_CARD).shippingFee.toNumber()).toBe(475);
    expect(computeShippingFeeFromTerms(undefined, LIVE_CARD).shippingFee.toNumber()).toBe(475);
  });

  it('exposes the terms used so callers can audit the quote', () => {
    const quote = computeShippingFeeFromTerms(3.2, LIVE_CARD);
    expect(quote.baseRate.toNumber()).toBe(475);
    expect(quote.extraKgRate.toNumber()).toBe(100);
    expect(quote.freeBaseWeightKg.toNumber()).toBe(0);
  });

  it('handles Decimal-like terms from Prisma', () => {
    const quote = computeShippingFeeFromTerms(1, {
      baseRate: { toString: () => '475.00' },
      extraKgRate: { toString: () => '100.00' },
      freeBaseWeightKg: { toString: () => '0.00' },
    });
    expect(quote.shippingFee.toFixed(2)).toBe('575.00');
  });
});
