import { describe, expect, it } from 'vitest';

import { savedReportsListMode } from '@/lib/reports/savedReportsList.core';

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
