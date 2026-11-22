import { describe, expect, it } from 'vitest';
import {
  effectiveSaleDate,
  isWithinCommissionPeriod,
  payoutOverlapsCommissionPeriod,
} from '@/lib/services/commissionPeriod.core';

const september = {
  periodStart: new Date('2026-09-01T00:00:00.000Z'),
  periodEnd: new Date('2026-09-30T23:59:59.999Z'),
};

describe('payoutOverlapsCommissionPeriod', () => {
  it('shows a September commission paid in November in the September view', () => {
    const payout = {
      // Selected window is the commission period, not the payment date.
      periodStart: new Date('2026-09-01T00:00:00.000Z'),
      periodEnd: new Date('2026-09-30T23:59:59.999Z'),
      paidAt: new Date('2026-11-05T10:00:00.000Z'),
    };
    expect(payoutOverlapsCommissionPeriod(payout, september)).toBe(true);
    expect(payoutOverlapsCommissionPeriod(payout, {
      periodStart: new Date('2026-11-01T00:00:00.000Z'),
      periodEnd: new Date('2026-11-30T23:59:59.999Z'),
    })).toBe(false);
  });

  it('keeps a spanning payout visible in both months', () => {
    const payout = {
      periodStart: new Date('2026-09-15T00:00:00.000Z'),
      periodEnd: new Date('2026-10-15T23:59:59.999Z'),
    };
    expect(
      payoutOverlapsCommissionPeriod(payout, {
        periodStart: new Date('2026-10-01T00:00:00.000Z'),
        periodEnd: new Date('2026-10-31T23:59:59.999Z'),
      }),
    ).toBe(true);
  });

  it('supports an open-ended filter and rejects invalid dates', () => {
    expect(
      payoutOverlapsCommissionPeriod(september, { periodStart: september.periodStart }),
    ).toBe(true);
    expect(
      payoutOverlapsCommissionPeriod(
        { periodStart: new Date('invalid'), periodEnd: september.periodEnd },
        september,
      ),
    ).toBe(false);
  });
});

describe('effectiveSaleDate', () => {
  it('uses the accounting sale date when present', () => {
    expect(
      effectiveSaleDate({
        saleDate: new Date('2026-09-12T10:00:00.000Z'),
        createdAt: new Date('2026-11-05T10:00:00.000Z'),
      })?.toISOString(),
    ).toBe('2026-09-12T10:00:00.000Z');
  });

  it('falls back to createdAt for pre-saleDate rows', () => {
    expect(
      effectiveSaleDate({
        saleDate: null,
        createdAt: new Date('2026-08-31T23:00:00.000Z'),
      })?.toISOString(),
    ).toBe('2026-08-31T23:00:00.000Z');
  });

  it('returns null when both dates are unusable', () => {
    expect(effectiveSaleDate({ saleDate: null, createdAt: null })).toBeNull();
  });
});

describe('isWithinCommissionPeriod', () => {
  it('uses inclusive bounds', () => {
    expect(isWithinCommissionPeriod(september.periodStart, september)).toBe(true);
    expect(isWithinCommissionPeriod(september.periodEnd, september)).toBe(true);
    expect(
      isWithinCommissionPeriod(new Date('2026-10-01T00:00:00.000Z'), september),
    ).toBe(false);
  });
});
