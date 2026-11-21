import { describe, expect, it } from 'vitest';

import {
  expenseCategoryLabel,
  formatReportDateRange,
} from '@/lib/reports/labels';

describe('expenseCategoryLabel (ARGUS #440)', () => {
  it('renders enum categories in sentence case', () => {
    expect(expenseCategoryLabel('MISCELLANEOUS')).toBe('Miscellaneous');
    expect(expenseCategoryLabel('SALARIES')).toBe('Salaries');
  });

  it('replaces underscores instead of leaving them visible', () => {
    expect(expenseCategoryLabel('TEA_SUGAR')).toBe('Tea sugar');
    expect(expenseCategoryLabel('STAFF_MEALS')).toBe('Staff meals');
  });

  it('falls back for empty values', () => {
    expect(expenseCategoryLabel(null)).toBe('Uncategorised');
    expect(expenseCategoryLabel('  ')).toBe('Uncategorised');
  });
});

describe('formatReportDateRange (ARGUS #440)', () => {
  it('uses day-first dates in en-GB order', () => {
    expect(formatReportDateRange('2026-09-01', '2026-09-30')).toBe(
      '1 Sep 2026 - 30 Sep 2026',
    );
  });

  it('keeps an unparseable value visible instead of printing Invalid Date', () => {
    expect(formatReportDateRange('not-a-date', '2026-09-30')).toBe(
      'not-a-date - 30 Sep 2026',
    );
  });
});
