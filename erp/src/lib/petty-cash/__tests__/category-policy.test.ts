import { describe, expect, it } from 'vitest';

import {
  categoryDenialReason,
  isCategoryEnabledForFund,
  selectFormExpenseCategories,
} from '@/lib/petty-cash/category-policy';
import { EXPENSE_CATEGORIES } from '@/lib/validators/expense.validators';

const ENABLED = ['MISCELLANEOUS', 'STAFF_MEALS', 'TEA_SUGAR', 'OFFICE_STATIONERY', 'TRAVEL'];

describe('petty-cash active-category policy (ARGUS #407)', () => {
  it('allows only categories in the fund allow-list', () => {
    expect(isCategoryEnabledForFund('TRAVEL', ENABLED)).toBe(true);
    expect(isCategoryEnabledForFund('RENT', ENABLED)).toBe(false);
    expect(isCategoryEnabledForFund('SALARIES', ENABLED)).toBe(false);
    expect(isCategoryEnabledForFund('UTILITIES', ENABLED)).toBe(false);
    expect(isCategoryEnabledForFund('ADVERTISING', ENABLED)).toBe(false);
  });

  it('treats an empty allow-list as nothing enabled', () => {
    expect(isCategoryEnabledForFund('MISCELLANEOUS', [])).toBe(false);
    expect(selectFormExpenseCategories([])).toEqual([]);
  });

  it('does not restrict when fund configuration is absent', () => {
    expect(isCategoryEnabledForFund('RENT', null)).toBe(true);
    expect(isCategoryEnabledForFund('RENT', undefined)).toBe(true);
    expect(selectFormExpenseCategories(null)).toEqual([...EXPENSE_CATEGORIES]);
  });

  it('returns a readable denial reason naming the category', () => {
    expect(categoryDenialReason('RENT', ENABLED)).toContain('RENT');
    expect(categoryDenialReason('TRAVEL', ENABLED)).toBeNull();
  });

  it('keeps the canonical category order in the form list', () => {
    expect(selectFormExpenseCategories(['TRAVEL', 'MISCELLANEOUS'])).toEqual([
      'MISCELLANEOUS',
      'TRAVEL',
    ]);
  });

  it('never invents a category outside the known enum', () => {
    expect(selectFormExpenseCategories(['COFFEE', 'TRAVEL'])).toEqual(['TRAVEL']);
  });
});
