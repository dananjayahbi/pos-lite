import { describe, it, expect } from 'vitest';
import {
  CreateExpenseSchema,
  EXPENSE_CATEGORIES,
} from '@/lib/validators/expense.validators';

describe('CreateExpenseSchema — petty-cash categories & receipt (docs 37, 38)', () => {
  it('exposes the petty-cash categories in the enum set', () => {
    expect(EXPENSE_CATEGORIES).toContain('STAFF_MEALS');
    expect(EXPENSE_CATEGORIES).toContain('TEA_SUGAR');
    expect(EXPENSE_CATEGORIES).toContain('OFFICE_STATIONERY');
    expect(EXPENSE_CATEGORIES).toContain('TRAVEL');
  });

  it('accepts a STAFF_MEALS expense with a receipt URL', () => {
    const parsed = CreateExpenseSchema.safeParse({
      category: 'STAFF_MEALS',
      amount: 450,
      description: 'Lunch for team',
      expenseDate: '2026-08-07',
      receiptImageUrl: 'https://example.com/receipt.png',
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts a TEA_SUGAR expense', () => {
    const parsed = CreateExpenseSchema.safeParse({
      category: 'TEA_SUGAR',
      amount: 1200,
      description: 'Monthly tea & sugar',
      expenseDate: '2026-08-07',
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts an OFFICE_STATIONERY expense linked to a petty-cash fund', () => {
    const parsed = CreateExpenseSchema.safeParse({
      category: 'OFFICE_STATIONERY',
      amount: 800,
      description: 'Printing paper',
      expenseDate: '2026-08-07',
      pettyCashFundId: 'cmfund000000000000000000',
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts a TRAVEL expense', () => {
    const parsed = CreateExpenseSchema.safeParse({
      category: 'TRAVEL',
      amount: 300,
      description: 'Delivery run',
      expenseDate: '2026-08-07',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects an unknown category', () => {
    const parsed = CreateExpenseSchema.safeParse({
      category: 'COFFEE',
      amount: 100,
      description: 'x',
      expenseDate: '2026-08-07',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects a non-positive amount', () => {
    const parsed = CreateExpenseSchema.safeParse({
      category: 'MISCELLANEOUS',
      amount: 0,
      description: 'x',
      expenseDate: '2026-08-07',
    });
    expect(parsed.success).toBe(false);
  });
});
