import { describe, expect, it } from 'vitest';

import { paginationSummary } from '@/components/orders/pagination';

/**
 * ARGUS #262 — the queue must show the real total, not just the API's default
 * 50-row page.
 */
describe('paginationSummary', () => {
  it('describes the first page of a multi-page queue', () => {
    expect(paginationSummary(1, 50, 79)).toEqual({
      start: 1,
      end: 50,
      totalPages: 2,
    });
  });

  it('describes the final partial page', () => {
    expect(paginationSummary(2, 50, 79)).toEqual({
      start: 51,
      end: 79,
      totalPages: 2,
    });
  });

  it('handles an empty queue', () => {
    expect(paginationSummary(1, 50, 0)).toEqual({
      start: 0,
      end: 0,
      totalPages: 1,
    });
  });

  it('clamps a page beyond the end to a sane page count', () => {
    expect(paginationSummary(9, 50, 79).totalPages).toBe(2);
  });

  it('handles a single full page', () => {
    expect(paginationSummary(1, 25, 25)).toEqual({
      start: 1,
      end: 25,
      totalPages: 1,
    });
  });
});
