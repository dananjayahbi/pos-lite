import { describe, it, expect } from 'vitest';
import {
  TopUpPettyCashSchema,
  UpdatePettyCashFundSchema,
} from '@/lib/validators/petty-cash.validators';

const validFundId = 'cmfund000000000000000000';

describe('UpdatePettyCashFundSchema - standalone fund (doc 36)', () => {
  it('accepts a name change only', () => {
    const parsed = UpdatePettyCashFundSchema.safeParse({
      fundId: validFundId,
      name: 'Day-to-day Float',
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts an opening balance update', () => {
    const parsed = UpdatePettyCashFundSchema.safeParse({
      fundId: validFundId,
      openingBalance: 30000,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.openingBalance).toBe(30000);
  });

  it('accepts a low-balance threshold (doc 40 foundation)', () => {
    const parsed = UpdatePettyCashFundSchema.safeParse({
      fundId: validFundId,
      lowBalanceThreshold: 5000,
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts clearing the low-balance threshold with null', () => {
    const parsed = UpdatePettyCashFundSchema.safeParse({
      fundId: validFundId,
      lowBalanceThreshold: null,
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts toggling the active expense categories', () => {
    const parsed = UpdatePettyCashFundSchema.safeParse({
      fundId: validFundId,
      activeCategories: ['STAFF_MEALS', 'TEA_SUGAR', 'OFFICE_STATIONERY'],
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects a negative opening balance', () => {
    const parsed = UpdatePettyCashFundSchema.safeParse({
      fundId: validFundId,
      openingBalance: -100,
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects an unknown category in activeCategories', () => {
    const parsed = UpdatePettyCashFundSchema.safeParse({
      fundId: validFundId,
      activeCategories: ['COFFEE'],
    });
    expect(parsed.success).toBe(false);
  });

  it('requires fundId', () => {
    const parsed = UpdatePettyCashFundSchema.safeParse({ name: 'Float' });
    expect(parsed.success).toBe(false);
  });
});

describe('TopUpPettyCashSchema - Add Cash In', () => {
  it('accepts a numeric amount and optional source / date / note', () => {
    const parsed = TopUpPettyCashSchema.safeParse({
      amount: 10000,
      sourceType: 'ACCOUNT',
      sourceAccountId: 'cmaccount0000000000000000',
      description: 'Monthly float top-up',
      entryDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.amount).toBe(10000);
      expect(parsed.data.sourceType).toBe('ACCOUNT');
      expect(parsed.data.entryDate).toBeInstanceOf(Date);
    }
  });

  it('accepts external cash without a source account', () => {
    const parsed = TopUpPettyCashSchema.safeParse({
      amount: '2500.50',
      sourceType: 'EXTERNAL',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.amount).toBe(2500.5);
      expect(parsed.data.sourceType).toBe('EXTERNAL');
      expect(parsed.data.sourceAccountId).toBeUndefined();
    }
  });

  it('requires a source account for a transfer path', () => {
    const parsed = TopUpPettyCashSchema.safeParse({
      amount: 100,
      sourceType: 'ACCOUNT',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects a source account on the external-cash path', () => {
    const parsed = TopUpPettyCashSchema.safeParse({
      amount: 100,
      sourceType: 'EXTERNAL',
      sourceAccountId: 'cmaccount0000000000000000',
    });
    expect(parsed.success).toBe(false);
  });

  it('infers the source type for older callers', () => {
    const external = TopUpPettyCashSchema.safeParse({ amount: 10 });
    expect(external.success).toBe(true);
    if (external.success) expect(external.data.sourceType).toBe('EXTERNAL');

    const transfer = TopUpPettyCashSchema.safeParse({
      amount: 10,
      sourceAccountId: 'cmaccount0000000000000000',
    });
    expect(transfer.success).toBe(true);
    if (transfer.success) expect(transfer.data.sourceType).toBe('ACCOUNT');
  });

  it('rejects a future-dated posting', () => {
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const parsed = TopUpPettyCashSchema.safeParse({ amount: 100, entryDate: future });
    expect(parsed.success).toBe(false);
  });

  it('accepts a current or backdated posting', () => {
    const today = new Date().toISOString();
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(TopUpPettyCashSchema.safeParse({ amount: 100, entryDate: today }).success).toBe(true);
    expect(TopUpPettyCashSchema.safeParse({ amount: 100, entryDate: past }).success).toBe(true);
  });

  it('rejects zero, negative, and non-numeric amounts', () => {
    for (const amount of [0, -1, 'abc', '']) {
      const parsed = TopUpPettyCashSchema.safeParse({ amount });
      expect(parsed.success, `amount=${String(amount)}`).toBe(false);
    }
  });

  it('rejects an invalid entry date', () => {
    const parsed = TopUpPettyCashSchema.safeParse({
      amount: 100,
      entryDate: 'not-a-date',
    });
    expect(parsed.success).toBe(false);
  });

  it('caps the description at 200 characters', () => {
    const parsed = TopUpPettyCashSchema.safeParse({
      amount: 100,
      description: 'x'.repeat(201),
    });
    expect(parsed.success).toBe(false);
  });
});
