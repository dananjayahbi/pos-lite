/**
 * Saved reports list state and presentation helpers (ARGUS #447, #449).
 *
 * The list used to print `JSON.stringify(filters)` and had no search or
 * pagination. These pure helpers keep the chips, filtering and paging rules
 * testable outside the page.
 */
import { SAVED_REPORT_SNAPSHOT_KEY } from '@/lib/reports/savedReportAccess.core';

export type SavedReportsListMode = 'loading' | 'error' | 'empty' | 'ready';

export function savedReportsListMode(input: {
  isLoading: boolean;
  isError: boolean;
  count: number;
}): SavedReportsListMode {
  if (input.isError) return 'error';
  if (input.isLoading) return 'loading';
  return input.count === 0 ? 'empty' : 'ready';
}

export interface SavedReportFilterChip {
  key: string;
  label: string;
  value: string;
}

const FILTER_LABELS: Record<string, string> = {
  from: 'From',
  to: 'To',
  search: 'Search',
  q: 'Search',
  category: 'Category',
  categoryId: 'Category',
  staffId: 'Staff',
  userId: 'User',
  paymentMethod: 'Payment method',
  status: 'Status',
  reportType: 'Report type',
  source: 'Source',
};

function humanizeFilterKey(key: string): string {
  const withoutPrefix = key.replace(/^(filter|filters)[._-]?/i, '');
  const words = withoutPrefix
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 'Filter';
  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function chipValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.trim() === '' ? null : value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => (typeof item === 'string' || typeof item === 'number' ? String(item) : null))
      .filter((item): item is string => item !== null && item.trim() !== '');
    return parts.length > 0 ? parts.join(', ') : null;
  }
  if (typeof value === 'object') return 'Saved filter';
  return String(value);
}

/**
 * Friendly "From 01 Oct 2026" chips instead of raw JSON. The internal snapshot
 * marker is not a user filter and is hidden.
 */
export function savedReportFilterChips(
  filters: Record<string, unknown> | null | undefined,
): SavedReportFilterChip[] {
  if (!filters) return [];

  const chips: SavedReportFilterChip[] = [];
  for (const [key, value] of Object.entries(filters)) {
    if (key === SAVED_REPORT_SNAPSHOT_KEY) continue;
    const displayValue = chipValue(value);
    if (displayValue === null) continue;
    chips.push({
      key,
      label: FILTER_LABELS[key] ?? humanizeFilterKey(key),
      value: displayValue,
    });
  }
  return chips.sort((a, b) => a.label.localeCompare(b.label));
}

export interface SavedReportSearchLike {
  name: string;
  reportType: string;
  format?: string | null;
  filters?: Record<string, unknown> | null;
}

/** Case-insensitive search over name, report type, format and filter values. */
export function filterSavedReports<T extends SavedReportSearchLike>(
  reports: readonly T[],
  query: string,
): T[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return [...reports];

  return reports.filter((report) => {
    const haystack = [
      report.name,
      report.reportType,
      report.format ?? '',
      ...savedReportFilterChips(report.filters).map((chip) => `${chip.label} ${chip.value}`),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(needle);
  });
}

export const SAVED_REPORTS_PAGE_SIZE = 10;

export interface SavedReportsPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Clamp a page number and slice the list; an empty list still has one page. */
export function paginateSavedReports<T>(
  reports: readonly T[],
  page: number,
  pageSize: number = SAVED_REPORTS_PAGE_SIZE,
): SavedReportsPage<T> {
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.trunc(pageSize) : SAVED_REPORTS_PAGE_SIZE;
  const total = reports.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const safePage = Math.min(Math.max(1, Number.isFinite(page) ? Math.trunc(page) : 1), totalPages);
  const start = (safePage - 1) * safePageSize;

  return {
    items: reports.slice(start, start + safePageSize),
    page: safePage,
    pageSize: safePageSize,
    total,
    totalPages,
  };
}
