import { describe, expect, it } from 'vitest';

import {
  returnItemCount,
  summarizeCustomerReturns,
} from '@/components/customers/customerReturns';

/**
 * ARGUS #310 — the customer Returns tab totals must reflect real rows.
 */
describe('customer returns summary', () => {
  it('returns zeroes for no returns', () => {
    expect(summarizeCustomerReturns([])).toEqual({
      count: 0,
      totalRefund: 0,
      totalItems: 0,
    });
    expect(summarizeCustomerReturns(null)).toEqual({
      count: 0,
      totalRefund: 0,
      totalItems: 0,
    });
  });

  it('sums decimal strings and line quantities', () => {
    const summary = summarizeCustomerReturns([
      { refundAmount: '125.50', lines: [{ quantity: 2 }, { quantity: 1 }] },
      { refundAmount: 74.5, lines: [{ quantity: 4 }] },
    ]);

    expect(summary.count).toBe(2);
    expect(summary.totalRefund).toBe(200);
    expect(summary.totalItems).toBe(7);
  });

  it('counts a return with no lines as zero items', () => {
    expect(returnItemCount({ refundAmount: '10.00', lines: null })).toBe(0);
  });

  it('ignores a malformed refund amount instead of poisoning the total', () => {
    expect(
      summarizeCustomerReturns([
        { refundAmount: '10.00' },
        { refundAmount: 'not-a-number', lines: [{ quantity: 1 }] },
      ]).totalRefund,
    ).toBe(10);
  });
});
