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
