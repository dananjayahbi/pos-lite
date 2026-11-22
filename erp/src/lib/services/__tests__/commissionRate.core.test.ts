import { describe, expect, it } from 'vitest';
import { resolveStoredCommissionRate } from '@/lib/services/commissionRate.core';

describe('resolveStoredCommissionRate', () => {
  it('uses the stored record rate even when the staff rate later changed', () => {
    // Earned at 10%; the staff's current User.commissionRate is irrelevant.
    const rate = resolveStoredCommissionRate([
      { baseAmount: '1000.00', earnedAmount: '100.00' },
    ]);
    expect(rate?.toFixed(2)).toBe('10.00');
  });

  it('weights duplicate/mixed-rate records by earned/base', () => {
    const rate = resolveStoredCommissionRate([
      { baseAmount: '1000.00', earnedAmount: '100.00' },
      { baseAmount: '500.00', earnedAmount: '75.00' },
    ]);
    // 175 / 1500 = 11.666... -> 11.67
    expect(rate?.toFixed(2)).toBe('11.67');
  });

  it('ignores negative reversal rows', () => {
    const rate = resolveStoredCommissionRate([
      { baseAmount: '1000.00', earnedAmount: '100.00' },
      { baseAmount: '-200.00', earnedAmount: '-20.00' },
    ]);
    expect(rate?.toFixed(2)).toBe('10.00');
  });

  it('returns null without a positive earning basis', () => {
    expect(resolveStoredCommissionRate([])).toBeNull();
    expect(
      resolveStoredCommissionRate([{ baseAmount: '0', earnedAmount: '0' }]),
    ).toBeNull();
    expect(
      resolveStoredCommissionRate([{ baseAmount: '-100', earnedAmount: '-10' }]),
    ).toBeNull();
  });
});
