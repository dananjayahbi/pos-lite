import { describe, expect, it } from 'vitest';

import {
  expenseAuditSnapshot,
  expenseChangedFields,
} from '@/lib/expenses/audit';

describe('expense audit snapshots (ARGUS #401)', () => {
  it('normalizes decimal amounts, dates and null links', () => {
    expect(
      expenseAuditSnapshot({
        category: 'TRAVEL',
        amount: { toString: () => '125.50' },
        description: 'Fuel',
        expenseDate: new Date('2026-09-16T10:00:00.000Z'),
        receiptImageUrl: null,
        pettyCashFundId: 'fund-1',
        paymentAccountId: null,
      }),
    ).toEqual({
      category: 'TRAVEL',
      amount: 125.5,
      description: 'Fuel',
      expenseDate: '2026-09-16T10:00:00.000Z',
      receiptImageUrl: null,
      pettyCashFundId: 'fund-1',
      paymentAccountId: null,
    });
  });

  it('reports only the fields that changed', () => {
    const before = expenseAuditSnapshot({
      category: 'TRAVEL',
      amount: 100,
      description: 'Fuel',
      expenseDate: '2026-09-16',
      pettyCashFundId: 'fund-1',
      paymentAccountId: 'acct-1',
    });
    const after = expenseAuditSnapshot({
      category: 'TRAVEL',
      amount: 100,
      description: 'Fuel receipt corrected',
      expenseDate: '2026-09-16',
      pettyCashFundId: null,
      paymentAccountId: null,
    });
    expect(expenseChangedFields(before, after)).toEqual([
      'description',
      'pettyCashFundId',
      'paymentAccountId',
    ]);
  });

  it('reports no changes for an identical snapshot', () => {
    const snapshot = expenseAuditSnapshot({
      category: 'RENT',
      amount: 1000,
      description: 'September rent',
      expenseDate: '2026-09-01',
    });
    expect(expenseChangedFields(snapshot, { ...snapshot })).toEqual([]);
  });
});
