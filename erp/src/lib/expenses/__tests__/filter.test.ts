import { describe, expect, it } from 'vitest';

import {
  EXPENSE_SEARCH_MAX_LENGTH,
  buildExpenseFilterWhere,
  normalizeExpenseSearch,
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
