import { describe, expect, it } from 'vitest';

import {
  compareRecoveryRate,
  computeRecoveryRate,
  formatRecoveryRate,
} from '@/lib/reports/recoveryRate.core';

describe('computeRecoveryRate (ARGUS #517)', () => {
  it('is undefined when there is no actionable outcome', () => {
    expect(computeRecoveryRate(0, 0)).toBeNull();
  });

  it('computes the percentage from actionable outcomes', () => {
    expect(computeRecoveryRate(1, 1)).toBe(50);
    expect(computeRecoveryRate(2, 1)).toBe(66.7);
  });
});

describe('formatRecoveryRate', () => {
  it('shows a hyphen for an undefined rate and a percent otherwise', () => {
    expect(formatRecoveryRate(null)).toBe('-');
    expect(formatRecoveryRate(undefined)).toBe('-');
    expect(formatRecoveryRate(0)).toBe('0%');
    expect(formatRecoveryRate(66.7)).toBe('66.7%');
  });
});

describe('compareRecoveryRate', () => {
  it('keeps undefined rates last in both directions', () => {
    expect(compareRecoveryRate(null, 50, 'desc')).toBe(1);
    expect(compareRecoveryRate(50, null, 'desc')).toBe(-1);
    expect(compareRecoveryRate(null, 50, 'asc')).toBe(1);
    expect(compareRecoveryRate(10, 50, 'desc')).toBe(40);
    expect(compareRecoveryRate(10, 50, 'asc')).toBe(-40);
  });
});
