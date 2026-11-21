import { describe, expect, it } from 'vitest';

import {
  validateCashFlowRange,
  validateCashFlowRangeDates,
} from '@/lib/reports/cashflowRange';

describe('validateCashFlowRange (ARGUS #422)', () => {
  it('accepts a from-before-to range', () => {
    expect(validateCashFlowRange('2026-09-01', '2026-09-30')).toEqual({
      ok: true,
      message: null,
    });
  });

  it('accepts a single-day range', () => {
    expect(validateCashFlowRange('2026-09-30', '2026-09-30').ok).toBe(true);
  });

  it('rejects the reported reversed range', () => {
    const result = validateCashFlowRange('2030-12-31', '2024-01-01');
    expect(result.ok).toBe(false);
    expect(result.message).toBe('From date must be on or before the To date.');
  });

  it('rejects missing or unparseable values', () => {
    expect(validateCashFlowRange('', '2026-09-30').ok).toBe(false);
    expect(validateCashFlowRange('2026-09-01', null).ok).toBe(false);
    expect(validateCashFlowRange('not-a-date', '2026-09-30').message).toBe(
      'Enter valid From and To dates.',
    );
    expect(validateCashFlowRange('2026-02-31', '2026-03-01').ok).toBe(false);
  });

  it('validates resolved dates on the server', () => {
    expect(
      validateCashFlowRangeDates(
        new Date(2026, 8, 1),
        new Date(2026, 8, 30),
      ).ok,
    ).toBe(true);
    expect(
      validateCashFlowRangeDates(
        new Date(2030, 11, 31),
        new Date(2024, 0, 1),
      ).ok,
    ).toBe(false);
    expect(validateCashFlowRangeDates(null, new Date()).ok).toBe(false);
  });
});
