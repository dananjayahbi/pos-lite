import { describe, expect, it } from 'vitest';

import { computeBulkVariantPrice } from '@/lib/services/bulkPrice.core';

/** ARGUS #140: bulk price updates must not write invalid/negative prices. */
describe('computeBulkVariantPrice', () => {
  const current = { costPrice: 1000, retailPrice: 2766.4 };

  it('allows a normal percentage increase', () => {
    const result = computeBulkVariantPrice(current, {
      mode: 'PERCENT',
      percentage: 10,
      direction: 'INCREASE',
      target: 'BOTH',
    });

    expect(result).toEqual({ ok: true, costPrice: 1100, retailPrice: 3043.04 });
  });

  it('rejects a decrease that would make a price negative', () => {
    const result = computeBulkVariantPrice(current, {
      mode: 'PERCENT',
      percentage: 150,
      direction: 'DECREASE',
      target: 'RETAIL',
    });

    expect(result).toEqual({ ok: false, reason: 'NON_POSITIVE_PRICE' });
  });

  it('rejects a 100% decrease (zero price)', () => {
    const result = computeBulkVariantPrice(current, {
      mode: 'PERCENT',
      percentage: 100,
      direction: 'DECREASE',
      target: 'BOTH',
    });

    expect(result).toEqual({ ok: false, reason: 'NON_POSITIVE_PRICE' });
  });

  it('rejects a fixed retail below cost', () => {
    const result = computeBulkVariantPrice(current, {
      mode: 'FIXED',
      costPrice: 500,
      retailPrice: 400,
    });

    expect(result).toEqual({ ok: false, reason: 'RETAIL_BELOW_COST' });
  });

  it('rejects a cost increase that overtakes retail', () => {
    const result = computeBulkVariantPrice(current, {
      mode: 'PERCENT',
      percentage: 300,
      direction: 'INCREASE',
      target: 'COST',
    });

    expect(result).toEqual({ ok: false, reason: 'RETAIL_BELOW_COST' });
  });

  it('rounds to 2 decimals', () => {
    const result = computeBulkVariantPrice(
      { costPrice: 10, retailPrice: 20 },
      { mode: 'PERCENT', percentage: 5, direction: 'INCREASE', target: 'BOTH' },
    );

    expect(result).toEqual({ ok: true, costPrice: 10.5, retailPrice: 21 });
  });

  it('accepts an exact retail-equals-cost boundary', () => {
    const result = computeBulkVariantPrice(current, {
      mode: 'FIXED',
      costPrice: 500,
      retailPrice: 500,
    });

    expect(result).toEqual({ ok: true, costPrice: 500, retailPrice: 500 });
  });
});
