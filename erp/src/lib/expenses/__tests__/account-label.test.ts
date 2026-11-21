import { describe, expect, it } from 'vitest';

import {
  EXPENSE_ACCOUNT_EMPTY_LABEL,
  EXPENSE_PAYMENT_ACCOUNTS_HREF,
  EXPENSE_PETTY_CASH_HREF,
  resolveExpenseAccountLabel,
} from '@/lib/expenses/account-label';

describe('resolveExpenseAccountLabel (ARGUS #399)', () => {
  it('prefers the linked payment account', () => {
    const label = resolveExpenseAccountLabel({
      paymentAccountId: 'acct-1',
      paymentAccount: { id: 'acct-1', name: 'Commercial Bank' },
      pettyCashFundId: 'fund-1',
      pettyCashFund: { id: 'fund-1', name: 'Main Petty Cash' },
    });
    expect(label).toEqual({
      label: 'Commercial Bank',
      source: 'ACCOUNT',
      href: EXPENSE_PAYMENT_ACCOUNTS_HREF,
    });
  });

  it('shows the fund name when the payment account is null', () => {
    const label = resolveExpenseAccountLabel({
      paymentAccountId: null,
      paymentAccount: null,
      pettyCashFundId: 'fund-1',
      pettyCashFund: { id: 'fund-1', name: 'Main Petty Cash' },
    });
    expect(label).toEqual({
      label: 'Main Petty Cash',
      source: 'PETTY_CASH',
      href: EXPENSE_PETTY_CASH_HREF,
    });
  });

  it('resolves names from lookup maps when a relation was not loaded', () => {
    expect(
      resolveExpenseAccountLabel(
        { paymentAccountId: 'acct-1' },
        { accountNameById: new Map([['acct-1', 'Cash Drawer']]) },
      ).label,
    ).toBe('Cash Drawer');

    expect(
      resolveExpenseAccountLabel(
        { paymentAccountId: null, pettyCashFundId: 'fund-1' },
        { fundNameById: { 'fund-1': 'Shop Float' } },
      ).label,
    ).toBe('Shop Float');
  });

  it('falls back to a visible label when the id has no known name', () => {
    expect(
      resolveExpenseAccountLabel({ paymentAccountId: 'acct-1' }).label,
    ).toBe('Linked account');
    expect(
      resolveExpenseAccountLabel({ paymentAccountId: null, pettyCashFundId: 'fund-1' }).label,
    ).toBe('Petty cash fund');
  });

  it('renders a plain hyphen only when the expense is unlinked', () => {
    expect(
      resolveExpenseAccountLabel({ paymentAccountId: null, pettyCashFundId: null }),
    ).toEqual({ label: EXPENSE_ACCOUNT_EMPTY_LABEL, source: 'NONE', href: null });
    expect(EXPENSE_ACCOUNT_EMPTY_LABEL).toBe('-');
  });

  it('treats an empty embedded name as missing', () => {
    expect(
      resolveExpenseAccountLabel({
        paymentAccountId: 'acct-1',
        paymentAccount: { id: 'acct-1', name: '   ' },
        pettyCashFundId: null,
      }).label,
    ).toBe('Linked account');
  });
});
