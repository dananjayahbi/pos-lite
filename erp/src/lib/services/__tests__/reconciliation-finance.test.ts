import { describe, it, expect } from 'vitest';
import { computeNetPayout } from '@/lib/services/rate-engine.service';
import { classifyDeductionAudit } from '@/lib/services/reconciliation-finance.service';

describe('computeNetPayout', () => {
  it('nets gross minus fee, COD commission, and VAT', () => {
    const net = computeNetPayout({
      grossCod: 1000,
      deliveryFee: 100,
      coddCommissionPct: 5,
      vatRatePct: 10,
    });
    // 1000 − (100 + 1000*0.05 + 1000*0.10) = 1000 − (100 + 50 + 100) = 750
    expect(net.toString()).toBe('750');
  });

  it('returns gross when no deductions are configured', () => {
    const net = computeNetPayout({ grossCod: 500 });
    expect(net.toString()).toBe('500');
  });

  it('rounds to two decimal places', () => {
    const net = computeNetPayout({ grossCod: 100, deliveryFee: 10, coddCommissionPct: 3 });
    // 100 − (10 + 3) = 87
    expect(net.toString()).toBe('87');
  });
});

describe('classifyDeductionAudit', () => {
  it('flags an over-charge when variance is positive', () => {
    expect(classifyDeductionAudit(5.5)).toBe('OVER_CHARGED');
  });

  it('flags an under-charge when variance is negative', () => {
    expect(classifyDeductionAudit(-3)).toBe('UNDER_CHARGED');
  });

  it('treats near-zero variance as compliant', () => {
    expect(classifyDeductionAudit(0)).toBe('COMPLIANT');
    expect(classifyDeductionAudit(0.005)).toBe('COMPLIANT');
  });
});
