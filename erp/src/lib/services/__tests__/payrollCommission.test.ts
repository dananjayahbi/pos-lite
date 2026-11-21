import { describe, expect, it } from 'vitest';

import {
  isPendingPayrollPayoutName,
  payrollPendingMarker,
  planPayrollCommission,
} from '@/lib/services/payrollCommission.core';

/**
 * ARGUS #372/#374 — payroll pays only positive outstanding commission, net of
 * returned/voided (negative) adjustments, and carries negative balances.
 */
describe('planPayrollCommission', () => {
  it('nets a returned-sale adjustment into the payable amount', () => {
    const plan = planPayrollCommission([
      { id: 'sale', earnedAmount: '100.00', paidAmount: '0.00', createdAt: new Date('2026-09-01') },
      { id: 'return', earnedAmount: '-15.00', paidAmount: '0.00', createdAt: new Date('2026-09-02') },
    ]);

    expect(plan.netOutstanding.toFixed(2)).toBe('85.00');
    expect(plan.payable.toFixed(2)).toBe('85.00');
    expect(plan.records.map((record) => record.id)).toEqual(['sale', 'return']);
  });

  it('never pays a net-negative balance and leaves the records open', () => {
    const plan = planPayrollCommission([
      { id: 'sale', earnedAmount: '40.00', paidAmount: '0.00' },
      { id: 'return', earnedAmount: '-90.00', paidAmount: '0.00' },
    ]);

    expect(plan.netOutstanding.toFixed(2)).toBe('-50.00');
    expect(plan.payable.toFixed(2)).toBe('0.00');
    expect(plan.records).toHaveLength(2);
  });

  it('drops already-settled records from the plan', () => {
    const plan = planPayrollCommission([
      { id: 'paid', earnedAmount: '100.00', paidAmount: '100.00' },
      { id: 'open', earnedAmount: '20.00', paidAmount: '5.00' },
    ]);

    expect(plan.payable.toFixed(2)).toBe('15.00');
    expect(plan.records.map((record) => record.id)).toEqual(['open']);
  });
});

describe('pending payroll payout marker', () => {
  it('identifies reserved payroll payouts only', () => {
    const marker = payrollPendingMarker('run-1');
    expect(isPendingPayrollPayoutName(marker)).toBe(true);
    expect(isPendingPayrollPayoutName('Cash Drawer')).toBe(false);
    expect(isPendingPayrollPayoutName(null)).toBe(false);
  });
});
