import { describe, it, expect } from 'vitest';
import { UpdatePettyCashFundSchema } from '@/lib/validators/petty-cash.validators';

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
