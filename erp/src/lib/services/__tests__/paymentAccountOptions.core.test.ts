import { describe, expect, it } from 'vitest';

import { selectPaymentAccountOptions } from '@/lib/services/paymentAccountOptions.core';

const accounts = [
  { id: 'cash', status: 'ACTIVE', pettyCashFundId: null },
  { id: 'bank', status: 'ACTIVE', pettyCashFundId: null },
  { id: 'petty', status: 'ACTIVE', pettyCashFundId: 'fund-1' },
  { id: 'old', status: 'CLOSED', pettyCashFundId: null },
];

/** ARGUS #431: dead petty-cash options must never reach the movement dialogs. */
describe('selectPaymentAccountOptions', () => {
  it('keeps only active accounts by default', () => {
    expect(selectPaymentAccountOptions(accounts).map((account) => account.id)).toEqual([
      'cash',
      'bank',
      'petty',
    ]);
  });

  it('excludes the petty-cash account for deposit/withdraw flows', () => {
    expect(
      selectPaymentAccountOptions(accounts, { excludePettyCash: true }).map(
        (account) => account.id,
      ),
    ).toEqual(['cash', 'bank']);
  });

  it('still excludes the account on the other side of the movement', () => {
    expect(
      selectPaymentAccountOptions(accounts, {
        excludeAccountId: 'cash',
        excludePettyCash: true,
      }).map((account) => account.id),
    ).toEqual(['bank']);
  });

  it('keeps petty cash available when a flow does not exclude it', () => {
    expect(
      selectPaymentAccountOptions(accounts, { excludeAccountId: 'cash' }).map(
        (account) => account.id,
      ),
    ).toContain('petty');
  });
});
