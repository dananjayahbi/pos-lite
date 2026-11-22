import { describe, expect, it } from 'vitest';

import { decideFundDelta } from '@/lib/petty-cash/fund-balance';

describe('fund delta under lock (ARGUS #403)', () => {
  it('accepts a spend that fits', () => {
    expect(decideFundDelta(1000, -250, { enforceNonNegative: true })).toEqual({
      currentBalance: 1000,
      nextBalance: 750,
      allowed: true,
      reason: null,
    });
  });

  it('rejects a spend above the locked balance', () => {
    const decision = decideFundDelta(1000, -1250, { enforceNonNegative: true });
    expect(decision.allowed).toBe(false);
    expect(decision.nextBalance).toBe(-250);
    expect(decision.reason).toContain('1000.00');
    expect(decision.reason).toContain('1250.00');
  });

  it('allows the same spend with explicit manager approval', () => {
    expect(
      decideFundDelta(1000, -1250, { enforceNonNegative: true, approved: true }),
    ).toMatchObject({ allowed: true, nextBalance: -250, reason: null });
  });

  it('does not enforce when the caller is refunding', () => {
    expect(
      decideFundDelta(-500, 500, { enforceNonNegative: false }),
    ).toMatchObject({ allowed: true, nextBalance: 0 });
  });

  it('rounds to cents', () => {
    expect(decideFundDelta('1099.9', 0.1).nextBalance).toBe(1100);
    expect(decideFundDelta('0.3', -0.1).nextBalance).toBe(0.2);
  });
});
