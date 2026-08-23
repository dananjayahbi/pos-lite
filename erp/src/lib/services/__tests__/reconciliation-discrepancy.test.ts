import { describe, it, expect } from 'vitest';
import {
  classifyDiscrepancy,
  isDiscrepant,
} from '@/lib/services/reconciliation-discrepancy.service';

describe('isDiscrepant', () => {
  it('flags null settlement as discrepant', () => {
    expect(isDiscrepant(1000, null)).toBe(true);
  });

  it('treats near-equal amounts as matched', () => {
    expect(isDiscrepant(1000, 1000.005)).toBe(false);
  });

  it('flags a short remittance as discrepant', () => {
    expect(isDiscrepant(1000, 900)).toBe(true);
  });
});

describe('classifyDiscrepancy', () => {
  it('classifies no remittance as UNPAID', () => {
    const c = classifyDiscrepancy({ expectedCod: 1000, settledAmount: null });
    expect(c.category).toBe('UNPAID');
    expect(c.variance).toBe(1000);
  });

  it('classifies an overpayment as OVER_RECEIVED', () => {
    const c = classifyDiscrepancy({ expectedCod: 1000, settledAmount: 1100 });
    expect(c.category).toBe('OVER_RECEIVED');
    expect(c.variance).toBe(100);
  });

  it('classifies a shortfall without a stated fee as UNDERPAID', () => {
    const c = classifyDiscrepancy({ expectedCod: 1000, settledAmount: 900 });
    expect(c.category).toBe('UNDERPAID');
  });

  it('classifies a shortfall with an unaccounted deduction as UNAUTHORIZED_DEDUCTION', () => {
    const c = classifyDiscrepancy({ expectedCod: 1000, settledAmount: 900, statedFees: 150 });
    expect(c.category).toBe('UNAUTHORIZED_DEDUCTION');
  });
});
