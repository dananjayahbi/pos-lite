import { describe, expect, it } from 'vitest';

import {
  linkForPaymentAccount,
  resolveExpenseLinkUpdate,
} from '@/lib/expenses/link';

describe('expense fund/account link (ARGUS #400)', () => {
  it('derives both IDs when a petty-cash account is selected', () => {
    expect(
      linkForPaymentAccount({ id: 'acct-pc', pettyCashFundId: 'fund-1' }),
    ).toEqual({ paymentAccountId: 'acct-pc', pettyCashFundId: 'fund-1' });
  });

  it('clears the fund when a non-fund account is selected', () => {
    expect(
      linkForPaymentAccount({ id: 'acct-bank', pettyCashFundId: null }),
    ).toEqual({ paymentAccountId: 'acct-bank', pettyCashFundId: null });
  });

  it('clears both when no account is selected', () => {
    expect(linkForPaymentAccount(null)).toEqual({
      paymentAccountId: null,
      pettyCashFundId: null,
    });
  });

  it('treats an explicit fund-null update as unlinking both sides', () => {
    expect(
      resolveExpenseLinkUpdate({
        oldFundId: 'fund-1',
        oldAccountId: 'acct-pc',
        pettyCashFundId: null,
      }),
    ).toEqual({ paymentAccountId: null, pettyCashFundId: null });
  });

  it('treats an explicit account-null update as unlinking both sides', () => {
    expect(
      resolveExpenseLinkUpdate({
        oldFundId: 'fund-1',
        oldAccountId: 'acct-pc',
        paymentAccountId: null,
      }),
    ).toEqual({ paymentAccountId: null, pettyCashFundId: null });
  });

  it('keeps an explicitly chosen replacement account', () => {
    expect(
      resolveExpenseLinkUpdate({
        oldFundId: 'fund-1',
        oldAccountId: 'acct-pc',
        pettyCashFundId: null,
        paymentAccountId: 'acct-bank',
      }),
    ).toEqual({ paymentAccountId: 'acct-bank', pettyCashFundId: null });
  });

  it('leaves untouched fields alone when neither side is supplied', () => {
    expect(
      resolveExpenseLinkUpdate({
        oldFundId: 'fund-1',
        oldAccountId: 'acct-pc',
      }),
    ).toEqual({ paymentAccountId: 'acct-pc', pettyCashFundId: 'fund-1' });
  });
});
