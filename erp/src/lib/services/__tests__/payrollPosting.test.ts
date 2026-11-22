import { describe, expect, it } from 'vitest';

import { buildPayrollPostingPlan } from '@/lib/services/payrollPosting.core';

/**
 * ARGUS #373 — salary + commission expenses must sum to company cost exactly.
 */
describe('buildPayrollPostingPlan', () => {
  it('splits company cost into salary and per-staff commission legs', () => {
    const plan = buildPayrollPostingPlan({
      periodMonth: '2026-09',
      runId: 'run-1',
      totalCompanyCost: '100000.00',
      commissionPayouts: [
        { id: 'p1', userId: 'u1', amount: '420.26' },
        { id: 'p2', userId: 'u2', amount: '100.00' },
      ],
    });

    expect(plan.legs).toHaveLength(3);
    expect(plan.legs[0]).toMatchObject({ category: 'SALARIES', amount: '99479.74' });
    expect(plan.legs[1]).toMatchObject({
      category: 'STAFF_COMMISSIONS',
      amount: '420.26',
      payoutId: 'p1',
    });
    expect(plan.total).toBe('100000.00');
  });

  it('posts one salary leg when there is no commission', () => {
    const plan = buildPayrollPostingPlan({
      periodMonth: '2026-09',
      runId: 'run-1',
      totalCompanyCost: '50000.00',
      commissionPayouts: [],
    });

    expect(plan.legs).toEqual([
      {
        category: 'SALARIES',
        amount: '50000.00',
        description: 'Salaries & statutory contributions - payroll 2026-09 (run-1)',
      },
    ]);
    expect(plan.total).toBe('50000.00');
  });

  it('never emits a zero or negative salary leg', () => {
    const plan = buildPayrollPostingPlan({
      periodMonth: '2026-09',
      runId: 'run-1',
      totalCompanyCost: '100.00',
      commissionPayouts: [{ id: 'p1', userId: 'u1', amount: '100.00' }],
    });

    expect(plan.legs.map((leg) => leg.category)).toEqual(['STAFF_COMMISSIONS']);
    expect(plan.total).toBe('100.00');
  });
});
