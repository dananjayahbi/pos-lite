import { describe, expect, it } from 'vitest';

import { formatShiftDateTime, formatShiftRupee } from '@/lib/shifts/shift-format';

describe('shift date formatting (ARGUS #117)', () => {
  it('renders a day-first en-GB date and 24h time', () => {
    expect(formatShiftDateTime('2026-11-14T20:24:00.000Z', 'UTC')).toBe(
      '14 Nov 2026, 20:24',
    );
  });

  it('returns a dash for missing or invalid values', () => {
    expect(formatShiftDateTime(null)).toBe('-');
    expect(formatShiftDateTime(undefined)).toBe('-');
    expect(formatShiftDateTime('')).toBe('-');
    expect(formatShiftDateTime('not-a-date')).toBe('-');
  });
});

describe('shift money formatting (ARGUS #117)', () => {
  it('puts the minus sign before the currency symbol', () => {
    expect(formatShiftRupee(-2978)).toBe('-Rs. 2,978.00');
    expect(formatShiftRupee('-2978.00')).toBe('-Rs. 2,978.00');
    expect(formatShiftRupee(2978)).toBe('Rs. 2,978.00');
    expect(formatShiftRupee(0)).toBe('Rs. 0.00');
  });

  it('can prefix a positive value with plus for differences', () => {
    expect(formatShiftRupee(2978, { sign: 'always' })).toBe('+Rs. 2,978.00');
    expect(formatShiftRupee(-2978, { sign: 'always' })).toBe('-Rs. 2,978.00');
    expect(formatShiftRupee(0, { sign: 'always' })).toBe('+Rs. 0.00');
  });

  it('falls back safely for a non-numeric value', () => {
    expect(formatShiftRupee('nope')).toBe('Rs. 0.00');
  });
});
