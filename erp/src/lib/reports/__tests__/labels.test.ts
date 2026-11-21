import { describe, expect, it } from 'vitest';

import {
  accountStatusLabel,
  accountTypeLabel,
  expenseCategoryLabel,
  formatReportDateRange,
  shareOfTotalPercent,
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

describe('cash-flow labels and shares (ARGUS #423)', () => {
  it('prints account types and statuses in sentence case', () => {
    expect(accountTypeLabel('PAYMENT_GATEWAY')).toBe('Payment gateway');
    expect(accountTypeLabel('CASH')).toBe('Cash');
    expect(accountStatusLabel('ACTIVE')).toBe('Active');
    expect(accountStatusLabel('CLOSED')).toBe('Closed');
    expect(accountStatusLabel(null)).toBe('-');
  });

  it('scales expense bars to the total, not the largest category', () => {
    // Salaries is 68.3% of total expenses.
    expect(shareOfTotalPercent('68300', '100000')).toBeCloseTo(68.3, 10);
    expect(shareOfTotalPercent('68300', '100000')).not.toBe(100);
  });

  it('returns zero for a zero or invalid total', () => {
    expect(shareOfTotalPercent('100', '0')).toBe(0);
    expect(shareOfTotalPercent('abc', '100')).toBe(0);
  });
});
