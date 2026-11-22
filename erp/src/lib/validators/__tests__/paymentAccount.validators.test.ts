import { describe, expect, it } from 'vitest';

import {
  AccountBookQuerySchema,
  CloseAccountSchema,
  CreatePaymentAccountSchema,
  DepositSchema,
  FundTransferSchema,
  UpdatePaymentAccountSchema,
  WithdrawalSchema,
} from '@/lib/validators/paymentAccount.validators';

/**
 * ARGUS #434: the payment-account money contract had no validator coverage.
 * These cases pin the boundaries the dialogs and API rely on.
 */
describe('payment account create/update', () => {
  it('accepts a create with an opening balance and details', () => {
    const parsed = CreatePaymentAccountSchema.safeParse({
      name: 'Commercial Bank - Main',
      type: 'BANK',
      openingBalance: '25000.50',
      details: [{ label: 'Branch', value: 'Colombo 03' }],
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.openingBalance).toBe(25000.5);
    }
  });

  it('rejects a negative or non-numeric opening balance', () => {
    for (const openingBalance of [-1, '-1', 'not-money']) {
      expect(
        CreatePaymentAccountSchema.safeParse({
          name: 'Cash Drawer',
          type: 'CASH',
          openingBalance,
        }).success,
      ).toBe(false);
    }
  });

  it('requires at least one field on update', () => {
    expect(UpdatePaymentAccountSchema.safeParse({}).success).toBe(false);
    expect(UpdatePaymentAccountSchema.safeParse({ note: null }).success).toBe(true);
  });
});

describe('payment account movements', () => {
  it('requires a positive deposit/withdrawal amount', () => {
    expect(DepositSchema.safeParse({ amount: 0 }).success).toBe(false);
    expect(DepositSchema.safeParse({ amount: '15.00' }).success).toBe(true);
    expect(WithdrawalSchema.safeParse({ amount: -5 }).success).toBe(false);
    expect(WithdrawalSchema.safeParse({ amount: '5' }).success).toBe(true);
  });

  it('rejects a transfer to the same account', () => {
    expect(
      FundTransferSchema.safeParse({
        fromAccountId: 'account-1',
        toAccountId: 'account-1',
        amount: 100,
      }).success,
    ).toBe(false);
  });

  it('accepts an optional close destination and note', () => {
    expect(CloseAccountSchema.safeParse({}).success).toBe(true);
    expect(
      CloseAccountSchema.safeParse({ transferToAccountId: 'account-2', note: 'retired' })
        .success,
    ).toBe(true);
  });
});

describe('account book query paging', () => {
  it('defaults to page 1 and caps the page size', () => {
    const parsed = AccountBookQuerySchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.page).toBe(1);
      expect(parsed.data.pageSize).toBe(50);
    }

    expect(AccountBookQuerySchema.safeParse({ pageSize: 500 }).success).toBe(false);
  });
});
