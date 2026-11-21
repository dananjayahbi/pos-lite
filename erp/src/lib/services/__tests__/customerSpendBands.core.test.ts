import { describe, expect, it } from 'vitest';

import {
  CUSTOMER_SPEND_BANDS,
  countCustomersBySpendBand,
  customerSpendBandFor,
  matchesCustomerSpendBand,
} from '@/lib/services/customerSpendBands.core';

/**
 * ARGUS #312: a customer with exactly Rs. 5,000 used to match both "under
 * 5,000" (`<=5000`) and "5,000 - 25,000" (`>=5000`), so the two band totals
 * disagreed by one. The bands must partition the spend range.
 */
describe('customer spend bands', () => {
  const under = CUSTOMER_SPEND_BANDS.find((band) => band.key === 'UNDER_5000')!;
  const middle = CUSTOMER_SPEND_BANDS.find((band) => band.key === 'FROM_5000_TO_24999')!;
  const top = CUSTOMER_SPEND_BANDS.find((band) => band.key === 'FROM_25000')!;

  it('puts the 5,000 boundary in exactly one band', () => {
    expect(matchesCustomerSpendBand(5000, under)).toBe(false);
    expect(matchesCustomerSpendBand(5000, middle)).toBe(true);
    expect(matchesCustomerSpendBand(5000, top)).toBe(false);
    expect(customerSpendBandFor(5000)).toBe('FROM_5000_TO_24999');
  });

  it('puts the 25,000 boundary in exactly one band', () => {
    expect(matchesCustomerSpendBand(25000, middle)).toBe(false);
    expect(matchesCustomerSpendBand(25000, top)).toBe(true);
    expect(customerSpendBandFor(25000)).toBe('FROM_25000');
  });

  it('keeps values just below a boundary in the lower band', () => {
    expect(customerSpendBandFor(4999.99)).toBe('UNDER_5000');
    expect(customerSpendBandFor(24999.99)).toBe('FROM_5000_TO_24999');
  });

  it('covers zero and negative data without dropping a customer', () => {
    expect(customerSpendBandFor(0)).toBe('UNDER_5000');
    expect(customerSpendBandFor(-1)).toBe('UNDER_5000');
  });

  it('counts each customer once and the buckets sum to the total', () => {
    const counts = countCustomersBySpendBand([
      { totalSpend: 0 },
      { totalSpend: 4999.99 },
      { totalSpend: 5000 },
      { totalSpend: 5000 },
      { totalSpend: 24999.99 },
      { totalSpend: 25000 },
      { totalSpend: '150000.00' },
    ]);

    expect(counts).toEqual({
      ANY: 7,
      UNDER_5000: 2,
      FROM_5000_TO_24999: 3,
      FROM_25000: 2,
    });
    expect(counts.UNDER_5000 + counts.FROM_5000_TO_24999 + counts.FROM_25000).toBe(
      counts.ANY,
    );
  });

  it('ignores non-numeric spend instead of miscounting it as zero', () => {
    const counts = countCustomersBySpendBand([
      { totalSpend: 'not-a-number' },
      { totalSpend: 100 },
    ]);
    expect(counts.ANY).toBe(1);
    expect(counts.UNDER_5000).toBe(1);
  });

  it('exposes a stable, unique key per band for the filter UI', () => {
    const keys = CUSTOMER_SPEND_BANDS.map((band) => band.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(CUSTOMER_SPEND_BANDS[0]?.key).toBe('ANY');
  });
});
