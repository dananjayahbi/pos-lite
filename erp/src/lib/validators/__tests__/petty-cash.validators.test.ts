import { describe, expect, it } from 'vitest';

import { TopUpPettyCashSchema } from '@/lib/validators/petty-cash.validators';

/**
 * ARGUS #415: "Add Cash In" source-type, date and amount policy.
 * `entryDate` accepts a past/today date, never a future posting.
 */
function parsable(payload: unknown) {
  return TopUpPettyCashSchema.safeParse(payload);
}

describe('TopUpPettyCashSchema', () => {
  it('infers EXTERNAL cash when no account is named', () => {
    const result = parsable({ amount: 1000, entryDate: '2026-11-20' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sourceType).toBe('EXTERNAL');
      expect(result.data.sourceAccountId ?? null).toBeNull();
    }
  });

  it('infers ACCOUNT when a source account is supplied', () => {
    const result = parsable({
      amount: '250.50',
      sourceAccountId: 'acct_1',
      entryDate: '2026-11-20',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sourceType).toBe('ACCOUNT');
      expect(result.data.amount).toBe(250.5);
    }
  });

  it('rejects ACCOUNT without a source account', () => {
    const result = parsable({ amount: 10, sourceType: 'ACCOUNT' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['sourceAccountId']);
    }
  });

  it('rejects EXTERNAL cash that names a source account', () => {
    const result = parsable({
      amount: 10,
      sourceType: 'EXTERNAL',
      sourceAccountId: 'acct_1',
    });
    expect(result.success).toBe(false);
  });

  it('requires a positive amount', () => {
    expect(parsable({ amount: 0 }).success).toBe(false);
    expect(parsable({ amount: -5 }).success).toBe(false);
    expect(parsable({ amount: 'not-a-number' }).success).toBe(false);
  });

  it('rejects a future-dated top-up but accepts today and the past', () => {
    const tomorrow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const result = parsable({ amount: 100, entryDate: tomorrow });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/future/i);
    }

    expect(
      parsable({ amount: 100, entryDate: new Date().toISOString().slice(0, 10) }).success,
    ).toBe(true);
    expect(parsable({ amount: 100, entryDate: '2020-01-01' }).success).toBe(true);
  });

  it('rejects an unparseable date', () => {
    expect(parsable({ amount: 100, entryDate: 'not-a-date' }).success).toBe(false);
  });

  it('caps the description at 200 characters', () => {
    expect(parsable({ amount: 100, description: 'x'.repeat(201) }).success).toBe(false);
    expect(parsable({ amount: 100, description: '  float  ' }).success).toBe(true);
  });
});
