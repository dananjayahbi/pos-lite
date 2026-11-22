import { describe, expect, it } from 'vitest';

import { resolveLowBalanceDisplay } from '@/lib/petty-cash/low-balance';

/** ARGUS #414: a positive balance at/below the threshold is low. */
describe('resolveLowBalanceDisplay', () => {
  it('flags a positive balance at or below the threshold', () => {
    expect(resolveLowBalanceDisplay(5000, 5000)).toEqual({
      isLow: true,
      isNegative: false,
      label: 'Low balance',
    });
    expect(resolveLowBalanceDisplay('4200.50', '5000')).toMatchObject({
      isLow: true,
      label: 'Low balance',
    });
  });

  it('leaves a healthy balance unflagged', () => {
    expect(resolveLowBalanceDisplay(5000.01, 5000)).toEqual({
      isLow: false,
      isNegative: false,
      label: null,
    });
    expect(resolveLowBalanceDisplay(0, null)).toEqual({
      isLow: false,
      isNegative: false,
      label: null,
    });
  });

  it('always flags a negative balance, even without a threshold', () => {
    expect(resolveLowBalanceDisplay(-1, null)).toEqual({
      isLow: true,
      isNegative: true,
      label: 'Negative balance',
    });
  });

  it('treats a missing/blank threshold as no limit', () => {
    expect(resolveLowBalanceDisplay(10, '')).toEqual({
      isLow: false,
      isNegative: false,
      label: null,
    });
    expect(resolveLowBalanceDisplay(10, undefined)).toMatchObject({ isLow: false });
  });
});
