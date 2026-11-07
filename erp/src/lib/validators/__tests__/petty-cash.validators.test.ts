import { describe, it, expect } from 'vitest';
import {
  TopUpPettyCashSchema,
  UpdatePettyCashFundSchema,
} from '@/lib/validators/petty-cash.validators';

const validFundId = 'cmfund000000000000000000';

describe('UpdatePettyCashFundSchema — standalone fund (doc 36)', () => {
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

describe('TopUpPettyCashSchema — Add Cash In', () => {
  it('accepts a numeric amount and optional source / date / note', () => {
    const parsed = TopUpPettyCashSchema.safeParse({
      amount: 10000,
      sourceAccountId: 'cmaccount0000000000000000',
      description: 'Monthly float top-up',
      entryDate: '2026-11-06',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.amount).toBe(10000);
      expect(parsed.data.entryDate).toBeInstanceOf(Date);
    }
  });

  it('coerces numeric strings and allows an external (no source) top-up', () => {
    const parsed = TopUpPettyCashSchema.safeParse({ amount: '2500.50' });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.amount).toBe(2500.5);
      expect(parsed.data.sourceAccountId).toBeUndefined();
    }
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
