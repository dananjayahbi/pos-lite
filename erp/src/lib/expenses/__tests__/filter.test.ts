import { describe, expect, it } from 'vitest';

import {
  EXPENSE_SEARCH_MAX_LENGTH,
  buildExpenseFilterWhere,
  isValidExpenseDate,
  normalizeExpenseSearch,
  validateExpenseDateRange,
} from '@/lib/expenses/filter';

/** ARGUS #404: description search combines with category and dates. */
describe('normalizeExpenseSearch', () => {
  it('trims, drops blanks and bounds the value', () => {
    expect(normalizeExpenseSearch('  fuel  ')).toBe('fuel');
    expect(normalizeExpenseSearch('   ')).toBeUndefined();
    expect(normalizeExpenseSearch(null)).toBeUndefined();
    expect(normalizeExpenseSearch('x'.repeat(500))).toHaveLength(EXPENSE_SEARCH_MAX_LENGTH);
  });
});

describe('buildExpenseFilterWhere', () => {
  it('always scopes to the tenant', () => {
    expect(buildExpenseFilterWhere('tenant-1', {})).toEqual({ tenantId: 'tenant-1' });
  });

  it('adds a case-insensitive description search', () => {
    const where = buildExpenseFilterWhere('t', { search: '  Fuel ' });
    expect(where.description).toEqual({ contains: 'Fuel', mode: 'insensitive' });
  });

  it('combines category, search and inclusive dates', () => {
    const where = buildExpenseFilterWhere('t', {
      category: 'TRAVEL',
      search: 'taxi',
      dateFrom: '2026-11-01',
      dateTo: '2026-11-30',
    });
    expect(where.category).toBe('TRAVEL');
    expect(where.description).toEqual({ contains: 'taxi', mode: 'insensitive' });
    const range = where.expenseDate as { gte: Date; lte: Date };
    expect(range.gte.getTime()).toBeLessThan(range.lte.getTime());
    // Inclusive end: the To-date covers the whole day.
    expect(range.lte.getHours()).toBe(23);
  });

  it('ignores an empty search', () => {
    expect(buildExpenseFilterWhere('t', { search: '   ' })).not.toHaveProperty('description');
  });
});

describe('expense date range validation (ARGUS #405)', () => {
  it('accepts a real calendar date', () => {
    expect(isValidExpenseDate('2026-11-20')).toBe(true);
    expect(isValidExpenseDate('2028-02-29')).toBe(true);
  });

  it('rejects malformed and impossible dates', () => {
    for (const value of ['not-a-date', '2026-13-01', '2026-02-31', '2026-1-1', '20261120']) {
      expect(isValidExpenseDate(value), value).toBe(false);
    }
  });

  it('reports the invalid parameter without throwing', () => {
    expect(validateExpenseDateRange({ dateFrom: 'nope' })).toMatch(/dateFrom/);
    expect(validateExpenseDateRange({ dateTo: 'nope' })).toMatch(/dateTo/);
    expect(
      validateExpenseDateRange({ dateFrom: '2026-11-30', dateTo: '2026-11-01' }),
    ).toMatch(/on or before/);
    expect(validateExpenseDateRange({})).toBeNull();
  });
});
