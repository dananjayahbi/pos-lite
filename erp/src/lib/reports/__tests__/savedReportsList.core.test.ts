import { describe, expect, it } from 'vitest';

import {
  SAVED_REPORTS_PAGE_SIZE,
  filterSavedReports,
  paginateSavedReports,
  savedReportFilterChips,
  savedReportsListMode,
} from '@/lib/reports/savedReportsList.core';

/** ARGUS #447: a failed request must not look like an empty library. */
describe('savedReportsListMode', () => {
  it('reports errors before loading or empty', () => {
    expect(savedReportsListMode({ isLoading: false, isError: true, count: 0 })).toBe('error');
    expect(savedReportsListMode({ isLoading: true, isError: true, count: 4 })).toBe('error');
  });

  it('reports loading, empty and ready', () => {
    expect(savedReportsListMode({ isLoading: true, isError: false, count: 0 })).toBe('loading');
    expect(savedReportsListMode({ isLoading: false, isError: false, count: 0 })).toBe('empty');
    expect(savedReportsListMode({ isLoading: false, isError: false, count: 2 })).toBe('ready');
  });
});

/** ARGUS #449: friendly chips, search and pagination instead of raw JSON. */
describe('savedReportFilterChips', () => {
  it('renders labelled chips and hides the internal snapshot marker', () => {
    const chips = savedReportFilterChips({
      from: '2026-10-01',
      to: '2026-10-31',
      categoryId: 'OILS_LIQUIDS',
      _snapshot: { asOf: '2026-11-01T10:00:00.000Z', source: 'CLIENT_SNAPSHOT' },
    });

    expect(chips).toEqual([
      { key: 'categoryId', label: 'Category', value: 'OILS_LIQUIDS' },
      { key: 'from', label: 'From', value: '2026-10-01' },
      { key: 'to', label: 'To', value: '2026-10-31' },
    ]);
  });

  it('joins arrays, skips empty values and never prints raw JSON for objects', () => {
    const chips = savedReportFilterChips({
      staffId: ['u1', 'u2'],
      search: '   ',
      nested: { secret: true },
    });

    expect(chips).toEqual([
      { key: 'nested', label: 'Nested', value: 'Saved filter' },
      { key: 'staffId', label: 'Staff', value: 'u1, u2' },
    ]);
    expect(JSON.stringify(chips)).not.toContain('"secret"');
  });
});

describe('filterSavedReports', () => {
  const reports = [
    { name: 'October P&L', reportType: 'profit-loss', format: 'pdf', filters: { from: '2026-10-01' } },
    { name: 'Staff sales', reportType: 'sales-by-staff', format: 'csv', filters: { staffId: 'u2' } },
  ];

  it('matches names, report types and filter values case-insensitively', () => {
    expect(filterSavedReports(reports, 'october').map((report) => report.name)).toEqual([
      'October P&L',
    ]);
    expect(filterSavedReports(reports, 'SALES-BY-STAFF').map((report) => report.name)).toEqual([
      'Staff sales',
    ]);
    expect(filterSavedReports(reports, 'u2').map((report) => report.name)).toEqual([
      'Staff sales',
    ]);
  });

  it('returns every report for an empty query', () => {
    expect(filterSavedReports(reports, '   ')).toHaveLength(2);
  });
});

describe('paginateSavedReports', () => {
  const reports = Array.from({ length: 12 }, (_, index) => ({ id: index + 1 }));

  it('pages at ten rows and clamps out-of-range pages', () => {
    const first = paginateSavedReports(reports, 1);
    expect(first.pageSize).toBe(SAVED_REPORTS_PAGE_SIZE);
    expect(first.totalPages).toBe(2);
    expect(first.items).toHaveLength(10);

    const second = paginateSavedReports(reports, 2);
    expect(second.items.map((item) => item.id)).toEqual([11, 12]);

    const tooFar = paginateSavedReports(reports, 99);
    expect(tooFar.page).toBe(2);
    expect(tooFar.items.map((item) => item.id)).toEqual([11, 12]);
  });

  it('keeps one page for an empty library', () => {
    const page = paginateSavedReports([], 3);
    expect(page.page).toBe(1);
    expect(page.totalPages).toBe(1);
    expect(page.items).toEqual([]);
  });
});
