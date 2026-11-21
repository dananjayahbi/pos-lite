import { describe, expect, it } from 'vitest';
import { validatePayrollAdvance } from '@/lib/payroll/advance-validation.core';

describe('validatePayrollAdvance', () => {
  it('allows an advance within net pay', () => {
    const result = validatePayrollAdvance({ requested: 5000, netBeforeAdvance: 28000 });
    expect(result.allowed).toBe('5000.00');
    expect(result.maxAdvance).toBe('28000.00');
    expect(result.capped).toBe(false);
    expect(result.message).toBeNull();
  });

  it('caps an advance at net pay instead of over-deducting', () => {
    const result = validatePayrollAdvance({ requested: 50000, netBeforeAdvance: '2728.76' });
    expect(result.allowed).toBe('2728.76');
    expect(result.maxAdvance).toBe('2728.76');
    expect(result.capped).toBe(true);
    expect(result.message).toContain('capped at 2728.76');
  });

  it('allows zero when no net pay remains', () => {
    const result = validatePayrollAdvance({ requested: 1000, netBeforeAdvance: 0 });
    expect(result.allowed).toBe('0.00');
    expect(result.capped).toBe(true);
  });

  it('treats negative/malformed inputs as zero', () => {
    const negative = validatePayrollAdvance({ requested: -5, netBeforeAdvance: 1000 });
    expect(negative.allowed).toBe('0.00');
    expect(negative.capped).toBe(false);

    const malformed = validatePayrollAdvance({
      requested: 'not-a-number',
      netBeforeAdvance: 'not-a-number',
    });
    expect(malformed.allowed).toBe('0.00');
    expect(malformed.maxAdvance).toBe('0.00');
  });

  it('does not cap an exact-net advance', () => {
    const result = validatePayrollAdvance({ requested: '28000.00', netBeforeAdvance: 28000 });
    expect(result.capped).toBe(false);
    expect(result.allowed).toBe('28000.00');
  });
});
