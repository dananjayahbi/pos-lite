import { describe, expect, it } from 'vitest';

import { computePettyCashPeriodStatement } from '@/lib/services/pettyCashReport.core';

/**
 * ARGUS #395 — a 1–16 Sep export must not combine an all-time opening and a
 * November top-up with only September expenses.
 */
describe('computePettyCashPeriodStatement', () => {
  it('computes a period opening and closing balance', () => {
    const statement = computePettyCashPeriodStatement({
      fundOpeningBalance: 10125,
      topUpsBefore: 0,
      expensesBefore: 0,
      topUpsInPeriod: 0,
      expensesInPeriod: 3500,
    });

    expect(statement.openingBalance.toNumber()).toBe(10125);
    expect(statement.totalTopUps.toNumber()).toBe(0);
    expect(statement.totalExpenses.toNumber()).toBe(3500);
    expect(statement.closingBalance.toNumber()).toBe(6625);
  });

  it('excludes a top-up outside the window from cash-in', () => {
    // The 1.00 PO top-up is dated 9 Nov; a Sep export must not show it as
    // September cash-in. If it is before the window it belongs to opening.
    const statement = computePettyCashPeriodStatement({
      fundOpeningBalance: 10125,
      topUpsBefore: 1,
      expensesBefore: 0,
      topUpsInPeriod: 0,
      expensesInPeriod: 3500,
    });

    expect(statement.openingBalance.toNumber()).toBe(10126);
    expect(statement.totalTopUps.toNumber()).toBe(0);
    expect(statement.closingBalance.toNumber()).toBe(6626);
  });

  it('does not include an after-window top-up at all', () => {
    const statement = computePettyCashPeriodStatement({
      fundOpeningBalance: 10125,
      topUpsBefore: 0,
      expensesBefore: 0,
      topUpsInPeriod: 0,
      expensesInPeriod: 3500,
    });
    // The 1.00 top-up is after the window and is neither opening nor cash-in.
    expect(statement.closingBalance.toNumber()).toBe(6625);
  });

  it('subtracts pre-window expenses from the opening balance', () => {
    const statement = computePettyCashPeriodStatement({
      fundOpeningBalance: 10125,
      topUpsBefore: 500,
      expensesBefore: 1000,
      topUpsInPeriod: 200,
      expensesInPeriod: 300,
    });

    expect(statement.openingBalance.toNumber()).toBe(9625);
    expect(statement.closingBalance.toNumber()).toBe(9525);
  });

  it('rounds to two decimals', () => {
    const statement = computePettyCashPeriodStatement({
      fundOpeningBalance: '0.005',
      topUpsBefore: 0,
      expensesBefore: 0,
      topUpsInPeriod: '0.004',
      expensesInPeriod: 0,
    });
    expect(statement.openingBalance.toNumber()).toBe(0.01);
    expect(statement.closingBalance.toNumber()).toBe(0.01);
  });
});
