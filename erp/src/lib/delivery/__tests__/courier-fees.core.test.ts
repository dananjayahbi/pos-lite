import { describe, expect, it } from 'vitest';

import { computeCourierFeeBreakdown } from '@/lib/delivery/courier-fees.core';

/** ARGUS #293: VAT is on the courier service (fee + commission), not gross COD. */
describe('computeCourierFeeBreakdown', () => {
  it('charges 18% VAT on fee + commission, not on the Rs 10,000 COD', () => {
    const breakdown = computeCourierFeeBreakdown({
      grossCod: 10_000,
      deliveryFee: 250,
      coddCommissionPct: 3,
      vatRatePct: 18,
    });

    expect(breakdown.codCommission.toFixed(2)).toBe('300.00');
    expect(breakdown.vatBase.toFixed(2)).toBe('550.00');
    expect(breakdown.vatAmount.toFixed(2)).toBe('99.00');
    expect(breakdown.totalDeduction.toFixed(2)).toBe('649.00');
    expect(breakdown.netPayout.toFixed(2)).toBe('9351.00');
  });

  it('uses commission alone as the VAT base when there is no delivery fee', () => {
    const breakdown = computeCourierFeeBreakdown({
      grossCod: 1000,
      deliveryFee: 0,
      coddCommissionPct: 5,
      vatRatePct: 10,
    });

    expect(breakdown.vatBase.toFixed(2)).toBe('50.00');
    expect(breakdown.vatAmount.toFixed(2)).toBe('5.00');
    expect(breakdown.netPayout.toFixed(2)).toBe('945.00');
  });

  it('returns the gross amount when no percentages are configured', () => {
    const breakdown = computeCourierFeeBreakdown({ grossCod: 500 });
    expect(breakdown.vatBase.toFixed(2)).toBe('0.00');
    expect(breakdown.vatAmount.toFixed(2)).toBe('0.00');
    expect(breakdown.netPayout.toFixed(2)).toBe('500.00');
  });

  it('rounds the components and the net consistently to two decimals', () => {
    const breakdown = computeCourierFeeBreakdown({
      grossCod: 100,
      deliveryFee: 10,
      coddCommissionPct: 3.333,
      vatRatePct: 18,
    });

    expect(breakdown.codCommission.toFixed(2)).toBe('3.33');
    expect(breakdown.vatBase.toFixed(2)).toBe('13.33');
    expect(breakdown.vatAmount.toFixed(2)).toBe('2.40');
    expect(breakdown.netPayout.toFixed(2)).toBe('84.27');
  });

  it('ignores negative percentages instead of increasing the payout', () => {
    const breakdown = computeCourierFeeBreakdown({
      grossCod: 100,
      deliveryFee: 10,
      coddCommissionPct: -5,
      vatRatePct: -18,
    });
    expect(breakdown.netPayout.toFixed(2)).toBe('90.00');
  });
});
