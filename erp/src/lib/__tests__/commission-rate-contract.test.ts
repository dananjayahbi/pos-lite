/**
 * ARGUS #342 — one commission-rate contract across the form, staff API,
 * commission engine and sale-side creation.
 */
import { describe, expect, it } from 'vitest';
import {
  COMMISSION_RATE_BOUND_MESSAGE,
  COMMISSION_RATE_MAX,
  COMMISSION_RATE_MIN,
  isValidCommissionRate,
  normalizeCommissionRate,
} from '@/lib/constants/commission-rate';

describe('commission-rate contract', () => {
  it('is the inclusive 0-100 range', () => {
    expect(COMMISSION_RATE_MIN).toBe(0);
    expect(COMMISSION_RATE_MAX).toBe(100);
    expect(typeof COMMISSION_RATE_BOUND_MESSAGE).toBe('string');
    expect(COMMISSION_RATE_BOUND_MESSAGE).toContain('0 and 100');
  });

  it('accepts boundary and normal rates', () => {
    for (const value of [0, 0.01, 5, 99.99, 100]) {
      expect(isValidCommissionRate(value), `${value} must be valid`).toBe(true);
    }
  });

  it('rejects above 100, negatives and non-numbers', () => {
    for (const value of [100.01, 100.5, 999.99, -0.01, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(isValidCommissionRate(value), `${String(value)} must be invalid`).toBe(false);
    }
    expect(isValidCommissionRate('5')).toBe(false);
    expect(isValidCommissionRate(null)).toBe(false);
  });

  it('normalises stored/submitted values, returning null when unusable', () => {
    expect(normalizeCommissionRate('5.00')).toBe(5);
    expect(normalizeCommissionRate(100)).toBe(100);
    expect(normalizeCommissionRate('0')).toBe(0);
    expect(normalizeCommissionRate('100.01')).toBeNull();
    expect(normalizeCommissionRate('999.99')).toBeNull();
    expect(normalizeCommissionRate('-1')).toBeNull();
    expect(normalizeCommissionRate(null)).toBeNull();
    expect(normalizeCommissionRate('')).toBeNull();
    expect(normalizeCommissionRate('abc')).toBeNull();
  });
});
