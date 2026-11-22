import { describe, expect, it } from 'vitest';
import { totalDeductionsIncludingEpf } from '@/lib/payroll/deductions.core';

describe('totalDeductionsIncludingEpf', () => {
  it('adds employee EPF to the no-pay + advances total', () => {
    expect(
      totalDeductionsIncludingEpf({ totalDeductions: '3000.00', employeeEpf: '2728.76' }),
    ).toBe('5728.76');
  });

  it('rounds half-up to cents and accepts numeric input', () => {
    expect(
      totalDeductionsIncludingEpf({ totalDeductions: 9615.38, employeeEpf: 6346.15 }),
    ).toBe('15961.53');
  });

  it('keeps the total equal to gross minus net when used with item fields', () => {
    const gross = 34109.56;
    const net = 28380.8;
    expect(
      totalDeductionsIncludingEpf({ totalDeductions: 3000, employeeEpf: 2728.76 }),
    ).toBe((gross - net).toFixed(2));
  });
});
