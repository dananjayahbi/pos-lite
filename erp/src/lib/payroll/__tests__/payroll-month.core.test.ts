import { describe, expect, it } from 'vitest';
import {
  currentPayrollMonth,
  validatePayrollMonth,
} from '@/lib/payroll/payroll-month.core';

const NOW = new Date(2026, 10, 22, 12, 0, 0); // 22 Nov 2026, local

describe('payroll month contract', () => {
  it('defaults to the current local month', () => {
    expect(currentPayrollMonth(NOW)).toBe('2026-11');
    expect(validatePayrollMonth(undefined, NOW)).toEqual({ ok: true, month: '2026-11' });
    expect(validatePayrollMonth('   ', NOW)).toEqual({ ok: true, month: '2026-11' });
  });

  it('rejects malformed months', () => {
    for (const month of ['2026-13', '2026-00', '26-11', '2026-1', '2026-11-01', 'nope']) {
      const result = validatePayrollMonth(month, NOW);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.problem).toBe('INVALID');
    }
  });

  it('rejects a future month but allows the current and earlier months', () => {
    expect(validatePayrollMonth('2026-12', NOW).ok).toBe(false);
    expect(validatePayrollMonth('2027-01', NOW).ok).toBe(false);
    expect(validatePayrollMonth('2026-11', NOW)).toEqual({ ok: true, month: '2026-11' });
    expect(validatePayrollMonth('2026-10', NOW)).toEqual({ ok: true, month: '2026-10' });
    expect(validatePayrollMonth('2020-01', NOW)).toEqual({ ok: true, month: '2020-01' });
  });

  it('compares by month, not by day, across a year boundary', () => {
    const january = new Date(2027, 0, 2);
    expect(validatePayrollMonth('2027-01', january).ok).toBe(true);
    expect(validatePayrollMonth('2026-12', january).ok).toBe(true);
    expect(validatePayrollMonth('2027-02', january).ok).toBe(false);
  });
});
