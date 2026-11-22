/**
 * Expense register filters (ARGUS #404).
 *
 * The list only supported category and dates, so a long period could not be
 * narrowed by description. Keeping the where-builder pure makes the new search
 * (and its interaction with the category and inclusive date range) testable
 * without Prisma.
 */
import { parseRangeEnd, parseRangeStart } from '@/lib/dates/inclusiveRange';
import type { ExpenseCategory } from '@/generated/prisma/client';

export const EXPENSE_SEARCH_MAX_LENGTH = 100;

export interface ExpenseFilterInput {
  category?: string | undefined;
  search?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
}

/** Trim, bound and drop an empty description search. */
export function normalizeExpenseSearch(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim() ?? '';
  if (trimmed === '') return undefined;
  return trimmed.slice(0, EXPENSE_SEARCH_MAX_LENGTH);
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date in `YYYY-MM-DD` form (`2026-02-31` is not). */
export function isValidExpenseDate(value: string): boolean {
  const match = DATE_ONLY.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return (
    date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day)
  );
}

/**
 * Validate the optional date range. Returns an error message for the standard
 * 400 envelope instead of letting an Invalid Date reach Prisma (ARGUS #405:
 * malformed dates used to surface as a 500).
 */
export function validateExpenseDateRange(input: {
  dateFrom?: string | null | undefined;
  dateTo?: string | null | undefined;
}): string | null {
  if (input.dateFrom && !isValidExpenseDate(input.dateFrom)) {
    return 'dateFrom must be a valid date (YYYY-MM-DD)';
  }
  if (input.dateTo && !isValidExpenseDate(input.dateTo)) {
    return 'dateTo must be a valid date (YYYY-MM-DD)';
  }
  if (input.dateFrom && input.dateTo && input.dateFrom > input.dateTo) {
    return 'dateFrom must be on or before dateTo';
  }
  return null;
}

export function buildExpenseFilterWhere(
  tenantId: string,
  filters: ExpenseFilterInput,
): Record<string, unknown> {
  const where: Record<string, unknown> = { tenantId };

  if (filters.category) {
    where.category = filters.category as ExpenseCategory;
  }

  const search = normalizeExpenseSearch(filters.search);
  if (search) {
    where.description = { contains: search, mode: 'insensitive' };
  }

  const dateFilter: Record<string, Date> = {};
  if (filters.dateFrom) {
    dateFilter.gte = parseRangeStart(filters.dateFrom);
  }
  if (filters.dateTo) {
    dateFilter.lte = parseRangeEnd(filters.dateTo);
  }
  if (Object.keys(dateFilter).length > 0) {
    where.expenseDate = dateFilter;
  }

  return where;
}
